# app/utils/alipay_parser.py

import csv
from typing import List, Dict, Optional
from datetime import datetime
import chardet

from app.schemas.bill import UnifiedBillRecord


class AlipayBillParser:
    """支付宝账单解析器"""

    # 支付宝账单中需要跳过的行数（包含用户信息、统计汇总等）
    SKIP_ROWS = 24

    # 原始列名到目标字段的映射
    FIELD_MAPPING = {
        '交易时间': 'transaction_date',
        '交易分类': 'transaction_type',
        '交易对方': 'payee',
        '对方账号': 'counterparty_account',
        '商品说明': 'description',
        '收/支': 'direction',
        '金额': 'amount_numeric',
        '收/付款方式': 'payment_method',
        '交易状态': 'transaction_status',
        '交易订单号': 'transaction_id',
        '商家订单号': 'merchant_order_id',
        '备注': 'remark',
    }

    @classmethod
    def parse(cls, file_path: str) -> List[UnifiedBillRecord]:
        """
        解析支付宝账单CSV文件，返回统一格式的账单记录列表
        """
        # 检测文件编码（支付宝导出的CSV多为GBK）
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            detected = chardet.detect(raw_data)
            encoding = detected.get('encoding', 'gbk')

        records = []

        with open(file_path, 'r', encoding=encoding) as f:
            # 跳过前导说明行
            for _ in range(cls.SKIP_ROWS):
                f.readline()

            # 读取表头行
            header_line = f.readline().strip()
            headers = header_line.split(',')

            # 建立列名到索引的映射
            col_index = {col: idx for idx, col in enumerate(headers)}

            # 读取数据行
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < len(headers):
                    continue

                record = cls._parse_row(row, col_index)
                if record:
                    records.append(record)

        return records

    @classmethod
    def _parse_row(cls, row: List[str], col_index: Dict[str, int]) -> Optional[UnifiedBillRecord]:
        """解析单行交易记录"""
        try:
            transaction_date_str = row[col_index.get('交易时间', -1)].strip()
            direction = row[col_index.get('收/支', -1)].strip()
            amount_str = row[col_index.get('金额', -1)].strip()
            transaction_status = row[col_index.get('交易状态', -1)].strip()

            # 只处理成功的交易
            if transaction_status not in ['交易成功', '支付成功']:
                return None

            # 解析日期 格式: 2024-01-15 14:30:25
            transaction_date = datetime.strptime(transaction_date_str, '%Y-%m-%d %H:%M:%S')

            # 解析金额（支付宝金额已带符号，如 -23.50）
            amount_numeric = float(amount_str)

            return UnifiedBillRecord(
                transaction_date=transaction_date,
                transaction_type=row[col_index.get('交易分类', -1)].strip(),
                payee=row[col_index.get('交易对方', -1)].strip(),
                description=row[col_index.get('商品说明', -1)].strip(),
                direction=direction,
                amount_numeric=amount_numeric,
                payment_method=row[col_index.get('收/付款方式', -1)].strip(),
                transaction_status=transaction_status,
                transaction_id=row[col_index.get('交易订单号', -1)].strip(),
                merchant_order_id=row[col_index.get('商家订单号', -1)].strip(),
                remark=row[col_index.get('备注', -1)].strip(),
                source_file_type='alipay',
            )
        except Exception as e:
            print(f"解析支付宝账单单行失败: {e}, row={row}")
            return None


def parse_alipay_bill(file_path: str) -> List[UnifiedBillRecord]:
    """便捷函数：解析支付宝账单"""
    return AlipayBillParser.parse(file_path)