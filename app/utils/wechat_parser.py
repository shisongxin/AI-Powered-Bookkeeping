# app/utils/wechat_parser.py

import csv
from typing import List, Dict, Optional, Union
from datetime import datetime
from pathlib import Path

import pandas as pd

from app.schemas.bill import UnifiedBillRecord


class WeChatBillParser:
    """微信支付账单解析器（支持 CSV 和 Excel 格式）"""

    # 微信账单中需要跳过的前导行数（CSV 格式）
    SKIP_ROWS_CSV = 16

    # 原始列名到目标字段的映射
    FIELD_MAPPING = {
        '交易时间': 'transaction_date',
        '交易类型': 'transaction_type',
        '交易对方': 'payee',
        '商品': 'description',
        '收/支': 'direction',
        '金额(元)': 'amount_numeric',
        '支付方式': 'payment_method',
        '当前状态': 'transaction_status',
        '交易单号': 'transaction_id',
        '商户单号': 'merchant_order_id',
        '备注': 'remark',
    }

    @classmethod
    def parse(cls, file_path: Union[str, Path]) -> List[UnifiedBillRecord]:
        """
        解析微信账单文件，自动识别 CSV 或 Excel 格式，返回统一格式的账单记录列表
        """
        file_path = Path(file_path)
        
        # 根据扩展名选择解析方法
        if file_path.suffix.lower() in ['.xlsx', '.xls']:
            return cls._parse_excel(file_path)
        elif file_path.suffix.lower() == '.csv':
            return cls._parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}，仅支持 .csv / .xlsx / .xls")
    
    @classmethod
    def _parse_csv(cls, file_path: Path) -> List[UnifiedBillRecord]:
        """解析 CSV 格式的微信账单"""
        records = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            # 跳过前导说明行
            for _ in range(cls.SKIP_ROWS_CSV):
                f.readline()
            
            # 读取表头行
            header_line = f.readline().strip()
            headers = header_line.split(',')
            col_index = {col: idx for idx, col in enumerate(headers)}
            
            # 读取数据行
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < len(headers):
                    continue
                record = cls._parse_row(row, col_index, source_type='csv')
                if record:
                    records.append(record)
        
        return records
    
    @classmethod
    def _parse_excel(cls, file_path: Path) -> List[UnifiedBillRecord]:
        """
        解析 Excel 格式的微信账单（.xlsx / .xls）
        
        处理流程：
        1. 用 pandas 读取 Excel，自动跳过前导说明行
        2. 根据表头建立字段映射
        3. 逐行解析并转换为统一格式
        """
        # 读取 Excel，第 17 行为表头行（索引 16）
        # header 参数指定哪一行作为列名
        df = pd.read_excel(
            file_path,
            header=17,           # 表头在第 17 行（0-indexed）
            dtype=str,           # 所有列先读为字符串，避免金额等字段自动转换
            keep_default_na=False,
        )
        
        # 跳过完全为空的行
        df = df.dropna(how='all')
        
        records = []
        # 建立列名到索引的映射（因为 pandas 列名就是表头，直接用列名访问更安全）
        # 但需要注意列名中可能包含空格或特殊字符，先清理一下
        df.columns = df.columns.str.strip()
        
        for _, row in df.iterrows():
            record = cls._parse_row_excel(row)
            if record:
                records.append(record)
        
        return records
    
    @classmethod
    def _parse_row_excel(cls, row: pd.Series) -> Optional[UnifiedBillRecord]:
        """解析 Excel 格式的单行交易记录"""
        try:
            transaction_date_str = cls._safe_get(row, '交易时间')
            direction = cls._safe_get(row, '收/支')
            amount_str = cls._safe_get(row, '金额(元)')
            transaction_status = cls._safe_get(row, '当前状态')
            
            # 只处理成功的交易
            if transaction_status != '支付成功':
                return None
            
            # 解析日期
            transaction_date = cls._parse_date(transaction_date_str)
            if not transaction_date:
                return None
            
            # 解析金额
            amount_numeric = cls._parse_amount(amount_str, direction)
            
            return UnifiedBillRecord(
                transaction_date=transaction_date,
                transaction_type=cls._safe_get(row, '交易类型'),
                payee=cls._safe_get(row, '交易对方'),
                description=cls._safe_get(row, '商品'),
                direction=direction,
                amount_numeric=amount_numeric,
                payment_method=cls._safe_get(row, '支付方式'),
                transaction_status=transaction_status,
                transaction_id=cls._safe_get(row, '交易单号'),
                merchant_order_id=cls._safe_get(row, '商户单号'),
                remark=cls._safe_get(row, '备注'),
                source_file_type='wechat',
            )
        except Exception as e:
            print(f"解析微信账单单行失败: {e}, row={row.to_dict() if hasattr(row, 'to_dict') else row}")
            return None
    
    @classmethod
    def _parse_row(cls, row: List[str], col_index: Dict[str, int], source_type: str = 'csv') -> Optional[UnifiedBillRecord]:
        """解析 CSV 格式的单行交易记录"""
        try:
            transaction_date_str = row[col_index.get('交易时间', -1)].strip()
            direction = row[col_index.get('收/支', -1)].strip()
            amount_str = row[col_index.get('金额(元)', -1)].strip()
            transaction_status = row[col_index.get('交易状态', -1)].strip()
            
            # 只处理成功的交易
            if transaction_status != '支付成功':
                return None
            
            # 解析日期
            transaction_date = datetime.strptime(transaction_date_str, '%Y-%m-%d %H:%M:%S')
            
            # 解析金额
            amount_numeric = cls._parse_amount(amount_str, direction)
            
            return UnifiedBillRecord(
                transaction_date=transaction_date,
                transaction_type=row[col_index.get('交易类型', -1)].strip(),
                payee=row[col_index.get('交易对方', -1)].strip(),
                description=row[col_index.get('商品', -1)].strip(),
                direction=direction,
                amount_numeric=amount_numeric,
                payment_method=row[col_index.get('支付方式', -1)].strip(),
                transaction_status=transaction_status,
                transaction_id=row[col_index.get('交易单号', -1)].strip(),
                merchant_order_id=row[col_index.get('商户单号', -1)].strip(),
                remark=row[col_index.get('备注', -1)].strip(),
                source_file_type='wechat',
            )
        except Exception as e:
            print(f"解析微信账单单行失败: {e}, row={row}")
            return None
    
    @staticmethod
    def _safe_get(row: pd.Series, key: str) -> str:
        """安全获取单元格值，返回字符串或空字符串"""
        val = row.get(key, '')
        if pd.isna(val):
            return ''
        return str(val).strip()
    
    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """解析日期字符串，支持多种格式"""
        if not date_str:
            return None
        # 支持的日期格式
        formats = [
            '%Y/%m/%d %H:%M:%S',    # Excel 中常见格式
            '%Y-%m-%d %H:%M:%S',    # 标准格式
            '%Y/%m/%d',             # 纯日期
            '%Y-%m-%d',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        # 如果都不匹配，尝试用 pandas 解析（更宽松）
        try:
            return pd.to_datetime(date_str).to_pydatetime()
        except Exception:
            print(f"无法解析的日期格式: {date_str}")
            return None
    
    @staticmethod
    def _parse_amount(amount_str: str, direction: str) -> float:
        """解析金额字符串，根据收支方向调整符号"""
        try:
            amount = float(amount_str)
        except ValueError:
            # 尝试去除特殊字符（如人民币符号等）
            import re
            clean_amount = re.sub(r'[^\d.-]', '', amount_str)
            amount = float(clean_amount) if clean_amount else 0.0
        
        if direction == '支':
            amount = -abs(amount)
        elif direction == '收':
            amount = abs(amount)
        return amount


def parse_wechat_bill(file_path: Union[str, Path]) -> List[UnifiedBillRecord]:
    """便捷函数：解析微信账单（自动识别 CSV/Excel）"""
    return WeChatBillParser.parse(file_path)