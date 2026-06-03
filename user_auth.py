import os
import json
from datetime import datetime
from utils.common import get_app_data_dir, encrypt_password


class UserAuth:
    """用户认证模块 - 管理用户登录、密码等功能"""
    
    def __init__(self):
        self.app_data_dir = get_app_data_dir()
        self.users_file = os.path.join(self.app_data_dir, 'users.json')
        self.users = self._load_users()
    
    def _load_users(self):
        """加载用户数据"""
        default_users = {
            "root": {
                "password": encrypt_password("Fs0753@0753"),
                "is_super": True
            }
        }
        
        if not os.path.exists(self.users_file):
            self._save_users(default_users)
            return default_users
        
        try:
            with open(self.users_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载用户数据失败: {e}")
            return default_users
    
    def _save_users(self, users):
        """保存用户数据"""
        try:
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存用户数据失败: {e}")
    
    def login(self, username, password):
        """用户登录验证"""
        if not username or not password:
            return False, None, False
        
        username = username.strip()
        
        if username in self.users:
            encrypted_password = encrypt_password(password)
            if self.users[username]['password'] == encrypted_password:
                return True, username, self.users[username].get('is_super', False)
        
        return False, None, False
    
    def verify_password(self, username, password):
        """验证密码是否正确"""
        if username in self.users:
            encrypted_password = encrypt_password(password)
            return self.users[username]['password'] == encrypted_password
        return False
    
    def change_password(self, username, old_password, new_password):
        """修改密码"""
        if not self.verify_password(username, old_password):
            return False, "当前密码错误"
        
        if not new_password:
            return False, "新密码不能为空"
        
        self.users[username]['password'] = encrypt_password(new_password)
        self._save_users(self.users)
        return True, "密码修改成功"
    
    def reset_password(self, username, new_password, super_password=None):
        """重置密码"""
        if username == "root":
            # 超级用户重置：需要验证码（初始密码+时间戳）
            current_time = datetime.now().strftime("%m%d%H")
            expected_code = "Fs0753@0753" + current_time
            if super_password != expected_code:
                return False, "超级用户验证码错误"
        else:
            # 普通用户重置：需要超级用户密码
            if not self.verify_password("root", super_password):
                return False, "超级用户密码错误"
        
        self.users[username]['password'] = encrypt_password(new_password)
        self._save_users(self.users)
        return True, "密码重置成功"
    
    def add_user(self, username, password, is_super=False):
        """添加新用户"""
        if not username or not password:
            return False, "用户名和密码不能为空"
        
        if username in self.users:
            return False, "用户名已存在"
        
        self.users[username] = {
            "password": encrypt_password(password),
            "is_super": is_super
        }
        self._save_users(self.users)
        return True, "用户添加成功"
    
    def delete_user(self, username):
        """删除用户"""
        if username == "root":
            return False, "不能删除超级用户root"
        
        if username not in self.users:
            return False, "用户不存在"
        
        del self.users[username]
        self._save_users(self.users)
        return True, "用户删除成功"
    
    def update_user(self, username, password=None, is_super=None):
        """更新用户信息"""
        if username not in self.users:
            return False, "用户不存在"
        
        if password:
            self.users[username]['password'] = encrypt_password(password)
        
        if is_super is not None:
            self.users[username]['is_super'] = is_super
        
        self._save_users(self.users)
        return True, "用户更新成功"
    
    def get_user_info(self, username):
        """获取用户信息"""
        if username in self.users:
            return {
                'username': username,
                'is_super': self.users[username].get('is_super', False)
            }
        return None
    
    def get_all_users(self):
        """获取所有用户列表"""
        return list(self.users.keys())
    
    def is_super_user(self, username):
        """检查是否为超级用户"""
        if username in self.users:
            return self.users[username].get('is_super', False)
        return False