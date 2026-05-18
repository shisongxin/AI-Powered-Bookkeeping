# tests/test_parsers.py

import sys
import os
# 将项目根目录添加到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path

from app.utils.wechat_parser import parse_wechat_bill
from app.utils.alipay_parser import parse_alipay_bill
from app.utils.bill_parser import parse_bill

def test_wechat_parser():
    # 请替换为实际的微信账单文件路径
    records = parse_wechat_bill('samples/微信支付账单流水文件(20260505-20260512).xlsx')
    print(f"微信：共解析 {len(records)} 条有效交易")
    for r in records[:5]:
        print(f"{r.transaction_date} | {r.payee} | {r.amount} | {r.transaction_type}")


def test_alipay_parser():
    # 请替换为实际的支付宝账单文件路径
    records = parse_alipay_bill('samples/支付宝交易明细(20260413-20260513).csv')
    print(f"支付宝：共解析 {len(records)} 条有效交易")
    for r in records[:5]:
        print(f"{r.transaction_date} | {r.payee} | {r.amount}")

def test_parser_bill():
    # 请替换为实际的任意账单文件路径
    records_weipay = parse_bill('samples/微信支付账单流水文件(20260505-20260512).xlsx')
    print(f"微信：共解析 {len(records_weipay)} 条有效交易")
    for r in records_weipay[:5]:
        print(f"{r.transaction_date} | {r.payee} | {r.amount} | {r.transaction_type}")

    records_alipay = parse_bill('samples/支付宝交易明细(20260413-20260513).csv')
    print(f"支付宝：共解析 {len(records_alipay)} 条有效交易")
    for r in records_alipay[:5]:
        print(f"{r.transaction_date} | {r.payee} | {r.amount}")

if __name__ == "__main__":
    # test_wechat_parser()
    # test_alipay_parser()
    test_parser_bill()