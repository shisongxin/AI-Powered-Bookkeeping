# -*- coding: utf-8 -*-
"""测试默认分类功能"""

from app.core.database import SessionLocal
from app.models.user import User
from app.services.default_categories import DefaultCategoryService
from app.core.auth import hash_password

db = SessionLocal()

try:
    # 清理之前的测试用户
    db.query(User).filter(User.username == 'test_default_cat').delete()
    db.commit()

    # 创建测试用户
    test_user = User(
        username='test_default_cat',
        password_hash=hash_password('test123'),
        email='test@example.com'
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)

    print(f'创建用户: {test_user.username} (id={test_user.id})')

    # 创建默认分类
    categories = DefaultCategoryService.create_default_categories(db, test_user)
    print(f'创建了 {len(categories)} 个默认分类:')

    for cat in categories[:5]:
        icon = cat.icon.encode('ascii', 'replace').decode('ascii')
        print(f'  - {icon} {cat.name} (color: {cat.color})')

    if len(categories) > 5:
        print(f'  ... 还有 {len(categories) - 5} 个')

    # 验证不会重复创建
    print('\n再次创建（应该跳过）:')
    categories2 = DefaultCategoryService.create_default_categories(db, test_user)
    print(f'创建了 {len(categories2)} 个分类（应为0）')

    print('\n[OK] 测试通过!')

finally:
    # 清理
    db.query(User).filter(User.username == 'test_default_cat').delete()
    db.commit()
    db.close()
