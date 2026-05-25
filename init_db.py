# init_db.py
"""数据库初始化脚本 — 通过 Alembic 迁移 + 种子数据"""
import subprocess
import sys

from sqlalchemy import text, inspect
from app.core.database import engine, SessionLocal
from app.models.bill import Bill       # noqa: F401 确保模型已注册
from app.models.category import Category
from app.config import settings


DEFAULT_CATEGORIES = [
    {"name": "餐饮", "icon": "\U0001f35c", "color": "#FF6B6B", "keywords": "餐厅,外卖,美食,饭,面,火锅,烧烤,奶茶,咖啡,早餐,午餐,晚餐,小吃,食堂,快餐,烘焙,甜品,饮品"},
    {"name": "交通", "icon": "\U0001f687", "color": "#4ECDC4", "keywords": "地铁,公交,打车,滴滴,出租车,高铁,火车,机票,航班,加油,充电,停车,高速,ETC,共享单车,骑行"},
    {"name": "购物", "icon": "\U0001f6d2", "color": "#45B7D1", "keywords": "淘宝,京东,拼多多,超市,商场,便利店,百货,服饰,数码,电器,家具,日用品,化妆品,护肤品"},
    {"name": "居住", "icon": "\U0001f3e0", "color": "#96CEB4", "keywords": "房租,物业,水电,燃气,宽带,网费,电话费,暖气,维修,装修,家政,清洁"},
    {"name": "娱乐", "icon": "\U0001f3ae", "color": "#FFEAA7", "keywords": "电影,游戏,音乐,视频,会员,订阅,旅游,景点,演出,运动,健身,KTV,剧本杀,密室,网吧"},
    {"name": "医疗", "icon": "\U0001f48a", "color": "#DDA0DD", "keywords": "医院,药,门诊,挂号,体检,诊所,牙科,眼科,中药,西药,医保"},
    {"name": "教育", "icon": "\U0001f4da", "color": "#87CEEB", "keywords": "书,课程,培训,考试,学费,报名,文具,打印,资料"},
    {"name": "通讯", "icon": "\U0001f4f1", "color": "#F0E68C", "keywords": "手机,话费,流量,充值"},
    {"name": "收入", "icon": "\U0001f4b0", "color": "#90EE90", "keywords": "工资,奖金,红包,退款,报销,兼职,理财,利息,分红,转账"},
    {"name": "其他", "icon": "\U0001f4cb", "color": "#C0C0C0", "keywords": ""},
]


def init():
    print("开始初始化数据库...")
    print(f"数据库URL: {settings.DATABASE_URL}")

    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("数据库连接成功！")
    except Exception as e:
        print(f"数据库连接失败: {e}")
        print("请检查：")
        print("1. PostgreSQL服务是否启动")
        print("2. 用户名/密码是否正确")
        print("3. 数据库 'bill_db' 是否存在")
        print(f"4. 连接字符串: {settings.DATABASE_URL}")
        return

    try:
        # 1. 确保迁移真实执行（处理 alembic_version 表标记过时的情况）
        inspector = inspect(engine)
        has_categories = inspector.has_table("categories")

        if not has_categories:
            print("检测到表不存在，清理 alembic 状态后重新迁移...")
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE IF EXISTS alembic_version"))

        print("正在执行数据库迁移...")
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
        print("迁移执行完成！")

        # 2. 种子默认分类
        with SessionLocal() as session:
            for cat_data in DEFAULT_CATEGORIES:
                existing = session.query(Category).filter(Category.name == cat_data["name"]).first()
                if not existing:
                    session.add(Category(**cat_data))
            session.commit()
            print(f"已种子 {len(DEFAULT_CATEGORIES)} 个默认分类")

    except Exception as e:
        print(f"初始化时出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    init()
