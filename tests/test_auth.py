# tests/test_auth.py
"""用户认证测试 — register / login / me"""

import sys
import os
# 将项目根目录添加到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path

import pytest
from unittest.mock import patch

from app.models.user import User


# ========== 1. 注册测试 ==========

class TestRegister:
    def test_register_success(self, api):
        """正常注册返回 token"""
        resp = api.post("/api/v1/auth/register", json={
            "username": "testuser",
            "password": "secret123",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_register_duplicate_username(self, api):
        """重复用户名返回 409"""
        api.post("/api/v1/auth/register", json={
            "username": "dupuser",
            "password": "secret123",
        })
        resp = api.post("/api/v1/auth/register", json={
            "username": "dupuser",
            "password": "anotherpass",
        })
        assert resp.status_code == 409
        assert "已被注册" in resp.json()["detail"]

    def test_register_short_password(self, api):
        """密码过短返回 422"""
        resp = api.post("/api/v1/auth/register", json={
            "username": "baduser",
            "password": "ab",
        })
        assert resp.status_code == 422

    def test_register_short_username(self, api):
        """用户名过短返回 422"""
        resp = api.post("/api/v1/auth/register", json={
            "username": "a",
            "password": "secret123",
        })
        assert resp.status_code == 422


# ========== 2. 登录测试 ==========

class TestLogin:
    def test_login_success(self, api):
        """正确凭据登录返回 token"""
        # 先注册
        api.post("/api/v1/auth/register", json={
            "username": "loginuser",
            "password": "mypassword",
        })
        # 登录
        resp = api.post("/api/v1/auth/login", json={
            "username": "loginuser",
            "password": "mypassword",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, api):
        """错误密码返回 401"""
        api.post("/api/v1/auth/register", json={
            "username": "pwuser",
            "password": "correct",
        })
        resp = api.post("/api/v1/auth/login", json={
            "username": "pwuser",
            "password": "wrong",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, api):
        """不存在的用户返回 401"""
        resp = api.post("/api/v1/auth/login", json={
            "username": "nobody",
            "password": "whatever",
        })
        assert resp.status_code == 401


# ========== 3. 个人信息测试 ==========

class TestMe:
    def test_me_with_valid_token(self, api):
        """有效 token 返回用户信息"""
        reg = api.post("/api/v1/auth/register", json={
            "username": "meuser",
            "password": "secret123",
        })
        token = reg.json()["access_token"]

        resp = api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "meuser"
        assert data["id"] is not None
        assert data["is_active"] is True

    def test_me_without_token(self, api):
        """无 token 返回 401"""
        resp = api.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token(self, api):
        """无效 token 返回 401"""
        resp = api.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401

    def test_me_with_malformed_header(self, api):
        """错误格式的 Authorization 头返回 401"""
        resp = api.get("/api/v1/auth/me", headers={"Authorization": "Basic abc123"})
        assert resp.status_code == 401

    def test_me_disabled_user(self, api, db):
        """被禁用的用户返回 403"""
        # 注册并获取 token
        reg = api.post("/api/v1/auth/register", json={
            "username": "disabled_user",
            "password": "secret123",
        })
        token = reg.json()["access_token"]

        # 手动禁用该用户
        user = db.query(User).filter(User.username == "disabled_user").first()
        user.is_active = False
        db.commit()

        resp = api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403


# ========== 4. 用户持久化测试 ==========

class TestUserPersistence:
    def test_user_stored_in_db(self, api, db):
        """注册后用户数据落库"""
        api.post("/api/v1/auth/register", json={
            "username": "dbuser",
            "password": "secret123",
            "email": "db@test.com",
        })

        user = db.query(User).filter(User.username == "dbuser").first()
        assert user is not None
        assert user.username == "dbuser"
        assert user.email == "db@test.com"
        assert user.password_hash != "secret123"  # 应该存储哈希
        assert user.is_active is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
