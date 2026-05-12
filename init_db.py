# init_db.py
import sys
from sqlalchemy import text
from app.core.database import engine, Base, SessionLocal
from app.models.bill import Bill
from app.config import settings

def init():
    print("开始初始化数据库...")
    print(f"数据库URL: {settings.DATABASE_URL}")
    
    # 测试连接
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ 数据库连接成功！")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("请检查：")
        print("1. PostgreSQL服务是否启动")
        print("2. 用户名/密码是否正确")
        print("3. 数据库 'bill_agent' 是否存在")
        print(f"4. 连接字符串: {settings.DATABASE_URL}")
        return
    
    # 创建表
    try:
        # 先删除所有表（开发环境）
        print("正在删除现有表...")
        Base.metadata.drop_all(bind=engine)
        
        # 创建新表
        print("正在创建表...")
        Base.metadata.create_all(bind=engine)
        
        print("✅ 数据库表创建完成！")
        
        # 可选：插入测试数据
        with SessionLocal() as session:
            # 这里可以插入一些测试数据
            # 例如：
            # test_bill = Bill(amount=100.0, description="测试账单")
            # session.add(test_bill)
            session.commit()
            print("✅ 测试数据插入完成！")
            
    except Exception as e:
        print(f"❌ 创建表时出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    init()