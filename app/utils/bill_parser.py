# app/utils/bill_parser.py

import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Union
import pandas as pd
import chardet
import pdfplumber

from app.schemas.bill import FlexibleBillRecord
import logging

logger = logging.getLogger(__name__)

class UniversalBillParser:
    """统一账单解析器：支持 Excel / CSV / PDF"""

    # 表头关键词（只要包含其中一个即认为是潜在表头行）
    HEADER_KEYWORDS = [
        "交易时间", "时间", "日期", "交易类型", "交易对方", "收/支", "收支", "金额",
        "商品", "摘要", "支付方式", "付款方式", "交易状态", "订单号", "备注",
    ]
    # 字段映射：输出字段 -> 可能的表头关键词列表
    FIELD_MAPPING = {
        "transaction_date": ["交易时间", "时间", "日期", "记账日期", "下单时间"],
        "direction": ["收/支", "收支", "收入/支出", "类型", "交易方向"],
        "amount": ["金额", "实付金额", "金额(元)", "交易金额", "收入", "支出", "付款金额"],
        "payee": ["交易对方", "对方", "商户名称", "收款方", "付款方", "对方昵称"],
        "description": ["商品", "商品说明", "摘要", "用途", "备注内容", "内容"],
        "transaction_type": ["交易类型", "类型", "交易分类", "分类"],
        "payment_method": ["支付方式", "付款方式", "收/付款方式", "支付工具"],
        "transaction_status": ["交易状态", "当前状态", "状态", "订单状态"],
        "transaction_id": ["交易单号", "交易订单号", "订单号", "交易号", "流水号"],
        "merchant_order_id": ["商户单号", "商家订单号", "商户订单号"],
        "remark": ["备注", "附言", "说明"],
    }
    
    SUPPORTED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".pdf"}

    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> List[FlexibleBillRecord]:
        """解析账单文件，自动识别格式和表头"""
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()
        if suffix in ['.xlsx', '.xls']:
            return cls._parse_excel(file_path)
        elif suffix == '.csv':
            return cls._parse_csv(file_path)
        elif suffix == '.pdf':
            return cls._parse_pdf(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")
    
    @classmethod
    def _parse_excel(cls, file_path: Path) -> List[FlexibleBillRecord]:
        # 读取全部数据（不设表头）
        df_raw = pd.read_excel(file_path, header=None, dtype=str, keep_default_na=False)
        header_idx = cls._find_header_row(df_raw)
        if header_idx is None:
            # 直接尝试把第一行当表头，避免部分文件识别失败
            df = pd.read_excel(file_path, dtype=str, keep_default_na=False)
        else:
            df = pd.read_excel(file_path, header=header_idx, dtype=str, keep_default_na=False)

        df = cls._normalize_dataframe(df)
        return cls._extract_records(df, source_file_type="excel")

    @classmethod
    def _parse_csv(cls, file_path: Path) -> List[FlexibleBillRecord]:
        # 检测编码
        with open(file_path, 'rb') as f:
            raw = f.read()
            enc = chardet.detect(raw)['encoding'] or 'utf-8'
        # 读取
        # pandas 有时会因为编码/分隔符问题读取失败，做一层兜底
        try:
            df_raw = pd.read_csv(file_path, header=None, dtype=str, keep_default_na=False, encoding=enc)
        except Exception:
            df_raw = pd.read_csv(file_path, header=None, dtype=str, keep_default_na=False, encoding=enc, sep=None, engine="python")
        header_idx = cls._find_header_row(df_raw)
        try:
            if header_idx is None:
                df = pd.read_csv(file_path, dtype=str, keep_default_na=False, encoding=enc)
            else:
                df = pd.read_csv(file_path, header=header_idx, dtype=str, keep_default_na=False, encoding=enc)
        except Exception:
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False, encoding=enc, sep=None, engine="python")

        df = cls._normalize_dataframe(df)
        return cls._extract_records(df, source_file_type="csv")

    @classmethod
    def _parse_pdf(cls, file_path: Path) -> List[FlexibleBillRecord]:
        records: List[FlexibleBillRecord] = []

        with pdfplumber.open(str(file_path)) as pdf:
            for page in pdf.pages:
                # 优先从表格提取
                tables = page.extract_tables()
                page_records = []
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    df = pd.DataFrame(table)
                    # 先尝试把首行识别为表头；识别失败则用位置型解析
                    df2 = cls._infer_pdf_table_dataframe(df)
                    if list(df2.columns) != list(range(len(df2.columns))):
                        df2 = cls._normalize_dataframe(df2)
                        page_records.extend(cls._extract_records(df2, source_file_type="pdf"))
                    else:
                        df = cls._normalize_dataframe(df)
                        page_records.extend(cls._extract_records_positional(df, source_file_type="pdf"))
                # 兜底：如果表格没解析出结果，再从纯文本行中解析
                if not page_records:
                    text = page.extract_text() or ""
                    if text.strip():
                        page_records.extend(cls._parse_pdf_text(text))
                records.extend(page_records)

        return records
    
    @classmethod
    def _extract_records_positional(cls, df: pd.DataFrame, source_file_type: str) -> List[FlexibleBillRecord]:
        """无表头时按位置解析，适合常见导出账单表（日期/商户/说明/收支/金额）"""
        records: List[FlexibleBillRecord] = []
        if df is None or df.empty:
            return records

        for _, row in df.iterrows():
            values = [str(v).strip() for v in row.tolist() if pd.notna(v) and str(v).strip()]
            if not values:
                continue

            row_text = " ".join(values)

            # 日期优先取第一列；金额优先取最后一列
            date_candidates = []
            if len(values) >= 1:
                date_candidates.append(values[0])
            date_candidates.append(cls._extract_date_from_text(row_text))

            transaction_date = None
            for cand in date_candidates:
                transaction_date = cls._parse_date(cand)
                if transaction_date:
                    break
            if transaction_date is None:
                continue

            amount_candidate = values[-1] if values else ""
            amount = cls._parse_amount(amount_candidate, values[-2] if len(values) >= 2 else "")
            if amount is None:
                amount = cls._parse_amount(cls._extract_amount_from_text(row_text), values[-2] if len(values) >= 2 else "")
            if amount is None:
                continue

            direction_hint = values[-2] if len(values) >= 2 else ""

            payee = values[1] if len(values) >= 2 else None
            description = values[2] if len(values) >= 3 else None
            if len(values) == 4:
                # 4列时通常是：日期 / 交易对方 / 收支 / 金额
                if cls._looks_like_direction(values[2]):
                    description = None
                else:
                    description = values[2]
            if len(values) >= 5:
                payee = values[1] or None
                description = values[2] or None
                direction_hint = values[3]

            records.append(
                FlexibleBillRecord(
                    transaction_date=transaction_date,
                    amount=amount,
                    direction=cls._infer_direction(amount, direction_hint),
                    payee=payee or None,
                    description=description or None,
                    transaction_type=None,
                    payment_method=None,
                    transaction_status=None,
                    transaction_id=None,
                    merchant_order_id=None,
                    remark=description or None,
                    source_file_type=source_file_type,
                    raw_line=row_text,
                )
            )

        return records
    
    @classmethod
    def _parse_pdf_text(cls, text: str) -> List[FlexibleBillRecord]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return []

        # 尝试定位表头
        header_idx = None
        for i, line in enumerate(lines):
            matched = sum(1 for kw in cls.HEADER_KEYWORDS if kw in line)
            if matched >= 2:
                header_idx = i
                break

        if header_idx is None:
            return []

        header_line = lines[header_idx]
        headers = cls._split_pdf_line(header_line)
        if len(headers) < 2:
            return []

        data_lines = lines[header_idx + 1 :]
        rows = []
        for line in data_lines:
            parts = cls._split_pdf_line(line)
            if len(parts) < 2:
                continue
            # 对齐列数
            if len(parts) < len(headers):
                parts += [""] * (len(headers) - len(parts))
            elif len(parts) > len(headers):
                parts = parts[: len(headers) - 1] + [" ".join(parts[len(headers) - 1 :])]
            rows.append(parts)

        if not rows:
            return []

        df = pd.DataFrame(rows, columns=headers)
        df = cls._normalize_dataframe(df)
        return cls._extract_records(df, source_file_type="pdf")

    @staticmethod
    def _split_pdf_line(line: str) -> List[str]:
        # 优先按多个空格/制表符切分，兼容导出的文本布局
        parts = re.split(r"[\t]+|\s{2,}", line)
        return [p.strip() for p in parts if p.strip()]

    @classmethod
    def _infer_pdf_table_dataframe(cls, df: pd.DataFrame) -> pd.DataFrame:
        """PDF table 里常见第一行是表头，这里做一次轻量识别"""
        if df.empty:
            return df
        first_row = " ".join(str(v) for v in df.iloc[0].tolist() if str(v).strip())
        matched = sum(1 for kw in cls.HEADER_KEYWORDS if kw in first_row)
        if matched >= 2:
            df = df.copy()
            df.columns = [str(v).strip() for v in df.iloc[0].tolist()]
            df = df.iloc[1:].reset_index(drop=True)
        return df
    
    @staticmethod
    def _normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """进行数据清洗和标准化处理"""
        df = df.copy()
        df.columns = [str(col).strip() for col in df.columns]
        # 去掉全空列、全空行
        df = df.dropna(axis=1, how="all")
        df = df.dropna(how="all")
        # 把空字符串统一成 NaN，方便后续判断
        df = df.replace(r"^\s*$", pd.NA, regex=True)
        return df.reset_index(drop=True)
    
    @classmethod
    def _find_header_row(cls, df: pd.DataFrame) -> Optional[int]:
        """扫描数据框，找到包含表头关键词的行索引"""
        for idx, row in df.iterrows():
            # 将整行所有单元格拼接成字符串
            row_text = ' '.join(str(cell).strip() for cell in row if pd.notna(cell) and str(cell).strip())
            if not row_text:
                continue
            score = sum(1 for kw in cls.HEADER_KEYWORDS if kw in row_text)
            # 检查是否包含足够多的关键词，兼顾短表头
            if score >= 2:
                return idx
        return None

    @classmethod
    def _extract_records(cls, df: pd.DataFrame, source_file_type: str) -> List[FlexibleBillRecord]:
        """从 DataFrame 中逐行提取记录"""
        records: List[FlexibleBillRecord] = []
        if df is None or df.empty:
            return records
        # 建立列名到列索引的映射（方便快速查找）
        col_index = {str(col).strip(): i for i, col in enumerate(df.columns)}

        for _, row in df.iterrows():
            # 跳过空行
            if row.isna().all():
                continue

            row_text = " ".join(str(v).strip() for v in row if pd.notna(v) and str(v).strip())
            if not row_text:
                continue
            # 提取日期，金额和支/收
            date_str = cls._get_cell(row, col_index, "transaction_date")
            amount_str = cls._get_cell(row, col_index, "amount")
            direction_str = cls._get_cell(row, col_index, "direction")
            # 兜底从整行文本提取
            if not date_str:
                date_str = cls._extract_date_from_text(row_text)
            if not amount_str:
                amount_str = cls._extract_amount_from_text(row_text)

            transaction_date = cls._parse_date(date_str) if date_str else None
            if transaction_date is None:
                continue
            amount = cls._parse_amount(amount_str, direction_str)
            if amount is None:
                continue
            # 如果没有方向列，则从金额正负推断；有方向则按方向标准化
            direction = cls._infer_direction(amount, direction_str)

            record = FlexibleBillRecord(
                transaction_date=transaction_date,
                amount=amount,
                direction=direction,
                payee=cls._get_cell(row, col_index, "payee") or None,
                description=cls._get_cell(row, col_index, "description") or None,
                transaction_type=cls._get_cell(row, col_index, "transaction_type") or None,
                payment_method=cls._get_cell(row, col_index, "payment_method") or None,
                transaction_status=cls._get_cell(row, col_index, "transaction_status") or None,
                transaction_id=cls._get_cell(row, col_index, "transaction_id") or None,
                merchant_order_id=cls._get_cell(row, col_index, "merchant_order_id") or None,
                remark=cls._get_cell(row, col_index, "remark") or None,
                source_file_type=source_file_type,
                raw_line=row_text,
            )
            records.append(record)

        return records

    @staticmethod
    def _get_cell(row: pd.Series, col_index: dict, field: str) -> str:
        """根据字段名从行中获取单元格值"""
        possible_cols = UniversalBillParser.FIELD_MAPPING.get(field, [])
        # 精确匹配
        for col_name, idx in col_index.items():
            if col_name in possible_cols:
                val = row.iloc[idx]
                if pd.notna(val) and str(val).strip():
                    return str(val).strip()
        # 模糊匹配：列名包含关键词
        for col_name, idx in col_index.items():
            for kw in possible_cols:
                if kw in col_name:
                    val = row.iloc[idx]
                    if pd.notna(val) and str(val).strip():
                        return str(val).strip()
        return ''

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """解析多种日期格式"""
        if not date_str:
            return None
        date_str = str(date_str).strip()
        # 处理中文日期格式
        date_str = date_str.replace("年", "-").replace("月", "-").replace("日", "")
        date_str = date_str.replace(".", "-")
        # 常见日期格式
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%m/%d/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
        ]
        # 先尝试直接匹配
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        # 尝试用 pandas 宽松解析
        try:
            ts = pd.to_datetime(date_str, errors="coerce")
            if pd.isna(ts):
                return None
            return ts.to_pydatetime()
        except Exception:
            return None

    @staticmethod
    def _parse_amount(amount_str: str, direction_str: str = '') -> Optional[float]:
        """解析金额，根据方向调整正负"""
        if not amount_str:
            return None
        amount_str = str(amount_str).strip()
        if not amount_str:
            return None
        # 去掉人民币符号和千分位逗号
        clean = amount_str.replace(",", "")
        # 抓取第一个数值
        match = re.search(r"[-+]?\d+(?:\.\d+)?", clean)
        if not match:
            return None

        try:
            amount = float(match.group())
        except ValueError:
            return None
        
        # 方向标准化：支出为负，收入为正
        direction_str = str(direction_str).strip()
        if direction_str.lower() in {"支", "支出", "消费", "付款", "转出", "expense", "debit", "pay"}:
            amount = -abs(amount)
        elif direction_str.lower() in {"收", "收入", "退款", "转入", "income", "credit", "refund"}:
            amount = abs(amount)
        return amount

    @staticmethod
    def _extract_date_from_text(text: str) -> str:
        """从整行文本中提取日期字符串"""
        # 匹配常见日期模式
        patterns = [
            r"(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})",
            r"(\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2}:\d{2})",
            r"(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})",
            r"(\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2})",
            r"(\d{4}-\d{1,2}-\d{1,2})",
            r"(\d{4}/\d{1,2}/\d{1,2})",
            r"(\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1)
        return ''

    @staticmethod
    def _extract_amount_from_text(text: str) -> str:
        """从整行文本中提取金额字符串"""
        # # 优先从“金额/实付/支出/收入”附近抓取
        patterns = [
            r"(?:金额|实付金额|交易金额|付款金额)[:：]?\s*([-+]?\d+(?:,\d{3})*(?:\.\d+)?)",
            r"(?:支出|收入)[:：]?\s*([-+]?\d+(?:,\d{3})*(?:\.\d+)?)",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1)
        decimal_matches = re.findall(r"[-+]?\d+(?:,\d{3})*\.\d+", text)
        if decimal_matches:
            return decimal_matches[-1]
        matches = re.findall(r"[-+]?\d+(?:,\d{3})*(?:\.\d+)?", text)
        if matches:
            return matches[-1]
        return ''

    @staticmethod
    def _looks_like_direction(text: str) -> bool:
        text = str(text).strip()
        return text.lower() in {"收", "收入", "支", "支出", "消费", "付款", "退款", "转出", "转入", "income", "expense", "credit", "debit", "pay", "refund"}

    @staticmethod
    def _infer_direction(amount: float, direction_str: str = '') -> str:
        """根据金额正负或方向字符串推断收支方向"""
        direction_str = str(direction_str).strip()
        if direction_str.lower() in {"支", "支出", "消费", "付款", "转出", "expense", "debit", "pay"}:
            return "支出"
        if direction_str.lower() in {"收", "收入", "退款", "转入", "income", "credit", "refund"}:
            return "收入"
        return "支出" if amount < 0 else "收入"


def parse_bill(file_path: Union[str, Path]) -> List[FlexibleBillRecord]:
    """通用账单解析入口"""
    return UniversalBillParser.parse(file_path)