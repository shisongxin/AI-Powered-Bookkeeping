"""PaddleOCR 账单识别服务 — 本地 OCR 引擎，精准提取金额/商户/日期/分类"""

import os
import re
import logging
from datetime import datetime
from typing import List, Optional

# ---- PaddlePaddle 兼容性修复 ----
# 必须在任何 PaddlePaddle 导入之前设置，禁用 OneDNN/MKLDNN
# 修复 Windows 上 "ConvertPirAttribute2RuntimeAttribute" 错误
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("KMP_AFFINITY", "disabled")
os.environ.setdefault("OMP_NUM_THREADS", "1")

from app.schemas.ocr import OCRResponse, ExtractedItem

logger = logging.getLogger(__name__)

# ---------- 正则提取规则 ----------

# 金额模式（组合三种）：
#   带货币符号 + 数字: ¥35.00, ￥128.50
#   纯数字 + 元后缀: 500元, -16.50元（依赖元后缀确认是金额）
#   裸小数: -16.50, 35.00（有小数点，排除日期格式）
_AMOUNT_WITH_SYMBOL = re.compile(r'[¥￥]\s*(-?\d+\.?\d{0,2})')
_AMOUNT_WITH_YUAN = re.compile(r'(-?\d+\.?\d{1,2})\s*元')
_AMOUNT_BARE_DECIMAL = re.compile(r'(?<!\d)(-?\d+\.\d{2})(?!\d)')
# 非金额行：日期/时间/订单号
_NON_AMOUNT_RE = re.compile(
    r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?'
    r'|\d{1,2}:\d{2}'
    r'|^\d{10,}$'
)
# 日期模式
_DATE_RE = re.compile(
    r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)'
)
_DATE_SHORT_RE = re.compile(
    r'(\d{1,2}[-/月]\d{1,2}[日]?)'
)
# 时间模式
_TIME_RE = re.compile(r'(\d{1,2}:\d{2}(?::\d{2})?)')

# 支付方式关键词
_PAYMENT_KEYWORDS = {
    "微信": "微信",
    "支付宝": "支付宝",
    "余额宝": "支付宝",
    "零钱": "微信",
    "银行卡": "银行卡",
    "花呗": "支付宝",
    "信用卡": "银行卡",
    "现金": "现金",
}

# 分类关键词映射
_CATEGORY_MAP = {
    "餐饮": ["餐厅", "外卖", "美食", "饭", "面", "火锅", "烧烤", "奶茶", "咖啡",
             "早餐", "午餐", "晚餐", "小吃", "食堂", "快餐", "烘焙", "甜品", "饮品",
             "麦当劳", "肯德基", "星巴克", "海底捞", "西贝"],
    "交通": ["地铁", "公交", "打车", "滴滴", "出租车", "高铁", "火车", "机票",
             "加油", "充电", "停车", "高速", "ETC", "单车", "骑行"],
    "购物": ["淘宝", "京东", "拼多多", "超市", "商场", "便利店", "百货",
             "服饰", "数码", "电器", "家具", "日用品", "化妆品", "护肤品"],
    "居住": ["房租", "物业", "水电", "燃气", "宽带", "网费", "暖气", "维修", "家政"],
    "娱乐": ["电影", "游戏", "音乐", "视频", "会员", "订阅", "旅游", "景点",
             "演出", "运动", "健身", "KTV"],
    "医疗": ["医院", "药", "门诊", "挂号", "体检", "诊所", "牙科", "眼科"],
    "教育": ["书", "课程", "培训", "考试", "学费", "报名", "文具"],
    "通讯": ["手机", "话费", "流量", "充值"],
    "收入": ["工资", "奖金", "红包", "退款", "报销", "兼职", "理财", "利息", "分红", "转账"],
}


def _classify_category(text: str) -> str:
    """根据文本关键词推断消费分类"""
    scores = {}
    for cat, keywords in _CATEGORY_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score
    if scores:
        return max(scores, key=scores.get)
    return "其他"


def _detect_payment(text: str) -> str:
    """检测支付方式"""
    for kw, method in _PAYMENT_KEYWORDS.items():
        if kw in text:
            return method
    return ""


def _parse_amount(text: str) -> Optional[float]:
    """从文本中提取金额，过滤日期/时间/订单号"""
    # 跳过日期、时间、订单号行
    if _NON_AMOUNT_RE.search(text):
        return None
    # 1) 带货币符号
    m = _AMOUNT_WITH_SYMBOL.search(text)
    if m:
        try: return float(m.group(1))
        except ValueError: pass
    # 2) 带"元"后缀
    m = _AMOUNT_WITH_YUAN.search(text)
    if m:
        try: return float(m.group(1))
        except ValueError: pass
    # 3) 裸小数（如 -16.50）
    m = _AMOUNT_BARE_DECIMAL.search(text)
    if m:
        try:
            amt = float(m.group(1))
            if amt < 2000 or '.' in m.group(1):
                return amt
        except ValueError: pass
    return None


def _has_amount(text: str) -> bool:
    """检测文本是否包含金额"""
    return bool(
        _AMOUNT_WITH_SYMBOL.search(text)
        or _AMOUNT_WITH_YUAN.search(text)
        or _AMOUNT_BARE_DECIMAL.search(text)
    )


def _parse_date(text: str, current_year: int = 0, current_month: int = 0) -> str:
    """从文本中提取日期，返回 YYYY-MM-DD"""
    m = _DATE_RE.search(text)
    if m:
        raw = m.group(1)
        raw = raw.replace("年", "-").replace("月", "-").replace("日", "").replace("/", "-")
        return raw[:10]
    m = _DATE_SHORT_RE.search(text)
    if m and current_year > 0:
        raw = m.group(1).replace("月", "-").replace("日", "").replace("/", "-")
        return f"{current_year}-{raw.zfill(5)}"[:10]
    return ""


def _is_merchant_line(text: str) -> bool:
    """判断文本行是否为商户名"""
    # 排除明显不是商户名的行
    excludes = ["支付", "收款", "余额", "合计", "总计", "小计", "订单", "时间", "日期"]
    if any(e in text for e in excludes):
        return False
    # 商户名特征：中文字符多，不包含金额
    if _has_amount(text):
        return False
    chinese_chars = len(re.findall(r'[一-鿿]', text))
    return chinese_chars >= 2


class PaddleOCRService:
    """基于 PaddleOCR 的本地 OCR 识别 + 结构化提取"""

    def __init__(self):
        self._ocr = None

    @property
    def ocr(self):
        """延迟加载 PaddleOCR（首次调用时初始化模型）。"""
        if self._ocr is None:
            try:
                # 尝试在导入后通过 paddle API 禁用 OneDNN
                import paddle
                try:
                    paddle.set_device('cpu')
                    # 尝试禁用 MKLDNN
                    if hasattr(paddle, 'framework'):
                        paddle.framework.core.globals()['FLAGS_use_mkldnn'] = False
                except Exception:
                    pass
            except ImportError:
                pass

            try:
                from paddleocr import PaddleOCR
                self._ocr = PaddleOCR(
                    lang='ch',
                    use_textline_orientation=True,
                )
                logger.info("PaddleOCR 模型加载成功")
            except ImportError:
                logger.error(
                    "PaddleOCR 未安装。推荐版本组合:\n"
                    "  pip install paddlepaddle==2.6.2 paddleocr==2.7.3"
                )
                raise
            except Exception as e:
                msg = str(e)
                if "ConvertPirAttribute" in msg or "onednn" in msg.lower():
                    logger.error(
                        f"PaddleOCR OneDNN/PIR 兼容性错误。\n"
                        f"  推荐方案: pip install paddlepaddle==2.6.2 paddleocr==2.7.3\n"
                        f"  或使用 Vision LLM 回退（无需 PaddleOCR）\n"
                        f"  原始错误: {e}"
                    )
                else:
                    logger.error(f"PaddleOCR 初始化失败: {e}")
                raise
        return self._ocr

    def recognize_from_bytes(self, image_bytes: bytes) -> list[str]:
        """从图片字节流中提取所有文本行（按从上到下顺序）"""
        import numpy as np
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)

        # 兼容 PaddleOCR 2.x (ocr()) 和 3.x (predict())
        if hasattr(self.ocr, 'predict'):
            result = self.ocr.predict(img_np)
        else:
            result = self.ocr.ocr(img_np)

        if not result:
            logger.warning("PaddleOCR 未检测到文本")
            return []

        # 统一格式提取：将 result 扁平化为文本行列表
        # PaddleOCR 2.x ocr():    [ [[[x,y],...], ('text', score)], ... ]
        # PaddleOCR 3.x predict(): [{'rec_text':..., 'rec_score':...}, ...]
        lines = []

        # 2.x: ocr() 返回 [detections] — 拆包外层
        if isinstance(result, list) and len(result) == 1 and isinstance(result[0], list):
            detections = result[0]
        else:
            detections = result

        for det in (detections or []):
            if det is None:
                continue
            if isinstance(det, dict):
                # 3.x
                text = det.get('rec_text', '')
                if text:
                    lines.append(text)
            elif isinstance(det, (list, tuple)) and len(det) >= 2:
                # 2.x: [[[x,y],...], ('text', score)]
                text_data = det[1]
                if isinstance(text_data, (list, tuple)) and len(text_data) > 0:
                    lines.append(str(text_data[0]))
                elif isinstance(text_data, str):
                    lines.append(text_data)

        logger.info(f"PaddleOCR 检测到 {len(lines)} 行文本")
        return lines

    def extract_transactions(self, text_lines: list[str],
                             ref_date: Optional[datetime] = None) -> OCRResponse:
        """从 OCR 文本行中提取结构化交易记录"""
        if not text_lines:
            return OCRResponse(
                success=False, raw_text="", items=[],
                confidence="low", message="图片中未识别到文字",
            )

        full_text = "\n".join(text_lines)
        now = ref_date or datetime.now()

        # 找出所有包含金额的行
        amount_lines = []
        for i, line in enumerate(text_lines):
            amt = _parse_amount(line)
            if amt is not None:
                amount_lines.append((i, line, amt))

        if not amount_lines:
            return OCRResponse(
                success=True, raw_text=full_text, items=[],
                confidence="low",
                message=f"识别到 {len(text_lines)} 行文字但未检测到金额，请确认图片为账单截图",
            )

        items = []
        for idx, line, amt in amount_lines:
            # 查找商户名（金额行之前的行）
            payee = ""
            for j in range(idx - 1, max(idx - 4, -1), -1):
                if _is_merchant_line(text_lines[j]):
                    payee = text_lines[j].strip()
                    break
            if not payee and idx > 0:
                payee = text_lines[idx - 1].strip()

            # 查找日期
            date_str = _parse_date(line, now.year, now.month)
            if not date_str:
                # 向前搜索
                for j in range(idx - 1, max(idx - 3, -1), -1):
                    date_str = _parse_date(text_lines[j], now.year, now.month)
                    if date_str:
                        break
            if not date_str:
                date_str = now.strftime("%Y-%m-%d")

            # 分类
            search_text = line + " " + payee
            category = _classify_category(search_text)

            # 支付方式
            payment = _detect_payment(line) or _detect_payment(full_text)

            # 统一规范：金额始终为正，根据关键词判断收支方向
            # 收入关键词匹配（工资、奖金、红包、退款、报销、理财等）
            _income_keywords = ["工资", "奖金", "红包", "退款", "报销", "理财", "利息", "分红", "转账", "收入", "兼职"]
            direction = "收入" if any(kw in (payee + line) for kw in _income_keywords) else "支出"

            items.append(ExtractedItem(
                transaction_date=date_str,
                amount=abs(amt),  # 始终为正
                direction=direction,
                payee=payee if payee else None,
                description=line.strip(),
                payment_method=payment if payment else None,
                category=category,
            ))

        confidence = "high" if len(items) >= 1 else "medium"
        return OCRResponse(
            success=True,
            raw_text=full_text,
            items=items,
            confidence=confidence,
            message=f"PaddleOCR 识别完成，提取到 {len(items)} 条交易记录",
        )
