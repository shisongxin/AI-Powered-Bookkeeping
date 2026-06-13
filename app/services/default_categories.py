# app/services/default_categories.py
"""默认分类服务 — 为新用户创建常用分类"""

import logging
from typing import List

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.category import Category

logger = logging.getLogger(__name__)

# 默认分类配置
DEFAULT_CATEGORIES = [
    {"name": "餐饮", "icon": "🍜", "color": "#FF6B6B", "keywords": "餐厅,外卖,美食,吃饭,午餐,晚餐,早餐,小吃,火锅,烧烤,奶茶,咖啡"},
    {"name": "交通", "icon": "🚗", "color": "#4ECDC4", "keywords": "打车,公交,地铁,高铁,飞机,加油,停车,过路费,车票,机票"},
    {"name": "购物", "icon": "🛒", "color": "#45B7D1", "keywords": "超市,商场,网购,京东,淘宝,拼多多,衣服,鞋子,包包,化妆品"},
    {"name": "娱乐", "icon": "🎮", "color": "#96CEB4", "keywords": "电影,游戏,KTV,旅游,景点,门票,娱乐,休闲,健身,运动"},
    {"name": "居住", "icon": "🏠", "color": "#FFEAA7", "keywords": "房租,水电,物业,宽带,话费,维修,家具,家电,装修"},
    {"name": "医疗", "icon": "💊", "color": "#DFE6E9", "keywords": "医院,药品,体检,挂号,诊疗,疫苗,医保,看病"},
    {"name": "教育", "icon": "📚", "color": "#74B9FF", "keywords": "学费,书本,培训,课程,考试,考证,学习,辅导"},
    {"name": "工资", "icon": "💰", "color": "#00B894", "keywords": "工资,奖金,报销,退款,收入,兼职,理财,利息"},
    {"name": "转账", "icon": "💸", "color": "#A29BFE", "keywords": "转账,红包,还款,借款,收款,支付宝,微信"},
    {"name": "其他", "icon": "📝", "color": "#B2BEC3", "keywords": "其他,杂项,未知,未分类"},
]


class DefaultCategoryService:
    """默认分类服务"""

    @staticmethod
    def create_default_categories(db: Session, user: User) -> List[Category]:
        """为新用户创建默认分类

        Args:
            db: 数据库会话
            user: 用户对象

        Returns:
            创建的默认分类列表
        """
        created = []

        for cat_config in DEFAULT_CATEGORIES:
            # 检查是否已存在（防止重复创建）
            existing = db.query(Category).filter(
                Category.user_id == user.id,
                Category.name == cat_config["name"]
            ).first()

            if existing:
                logger.debug(f"分类已存在: {cat_config['name']}, user_id={user.id}")
                continue

            # 创建新分类
            category = Category(
                user_id=user.id,
                name=cat_config["name"],
                icon=cat_config["icon"],
                color=cat_config["color"],
                keywords=cat_config["keywords"]
            )
            db.add(category)
            created.append(category)

        if created:
            db.commit()
            logger.info(f"为用户 {user.username} (id={user.id}) 创建了 {len(created)} 个默认分类")

        return created

    @staticmethod
    def get_default_categories() -> List[dict]:
        """获取默认分类配置（用于前端展示）"""
        return DEFAULT_CATEGORIES.copy()

    @staticmethod
    def reset_user_categories(db: Session, user: User) -> List[Category]:
        """重置用户分类为默认分类

        删除用户所有分类，然后重新创建默认分类

        Args:
            db: 数据库会话
            user: 用户对象

        Returns:
            创建的默认分类列表
        """
        # 删除用户所有分类
        deleted = db.query(Category).filter(
            Category.user_id == user.id
        ).delete()

        if deleted:
            logger.info(f"删除了用户 {user.username} 的 {deleted} 个分类")

        # 创建默认分类
        return DefaultCategoryService.create_default_categories(db, user)
