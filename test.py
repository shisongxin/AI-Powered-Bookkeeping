import requests

# 添加账单
resp = requests.post("http://localhost:8000/api/v1/bills/", json={
    "amount": 48.5,
    "category": "餐饮",
    "note": "午餐",
    "raw_text": "今天午餐花了48.5"
})
print(resp.json())

# 查询账单
resp = requests.get("http://localhost:8000/api/v1/bills/")
print(resp.json())