import os
import json
import hashlib
from utils.common import get_app_data_dir


# 权限定义
PERMISSIONS = {
    'add_entry': '增加账目',
    'edit_entry': '修改账目',
    'delete_entry': '删除账目',
    'import_entry': '导入账目',
    'export_data': '导出数据',
    'backup_data': '备份数据',
    'clear_database': '清空数据库',
    'manage_users': '管理用户',
}

# 默认管理员密码（可通过环境变量配置）
DEFAULT_ADMIN_PASSWORD = os.environ.get('ACCOUNT_BOOK_ADMIN_PASSWORD', 'Fs0753@0753')


def encrypt_password(password: str) -> str:
    """加密密码（使用SHA-256）"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


class User:
    """用户类"""
    
    def __init__(self, username: str, password_hash: str, is_super: bool = False, permissions: list = None):
        self.username = username
        self.password_hash = password_hash
        self.is_super = is_super
        self.permissions = permissions if permissions else []
    
    def has_permission(self, permission: str) -> bool:
        """检查是否有权限"""
        if self.is_super:
            return True
        return permission in self.permissions
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            'username': self.username,
            'password_hash': self.password_hash,
            'is_super': self.is_super,
            'permissions': self.permissions
        }


class UserManager:
    """用户管理类"""
    
    def __init__(self):
        self.users_file = os.path.join(get_app_data_dir(), 'users.json')
        self._init_users()
    
    def _init_users(self):
        """初始化用户数据"""
        if not os.path.exists(self.users_file):
            # 创建默认管理员用户
            default_user = User(
                username='root',
                password_hash=encrypt_password(DEFAULT_ADMIN_PASSWORD),
                is_super=True,
                permissions=list(PERMISSIONS.keys())
            )
            self._save_users([default_user])
        else:
            # 检查并迁移旧格式数据
            self._migrate_old_format()
    
    def _migrate_old_format(self):
        """迁移旧格式数据到新格式"""
        try:
            with open(self.users_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 检查是否是旧格式（对象形式）
            if isinstance(data, dict) and not 'username' in data:
                new_users = []
                for username, user_data in data.items():
                    new_users.append(User(
                        username=username,
                        password_hash=user_data.get('password', user_data.get('password_hash', '')),
                        is_super=user_data.get('is_super', False),
                        permissions=list(PERMISSIONS.keys()) if user_data.get('is_super', False) else []
                    ))
                self._save_users(new_users)
                print("已迁移旧格式用户数据")
        except Exception as e:
            print(f"迁移用户数据失败: {e}")
    
    def _load_users(self) -> list:
        """加载用户数据"""
        try:
            with open(self.users_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # 兼容旧格式
                if isinstance(data, dict) and not 'username' in data:
                    users = []
                    for username, user_data in data.items():
                        users.append(User(
                            username=username,
                            password_hash=user_data.get('password', user_data.get('password_hash', '')),
                            is_super=user_data.get('is_super', False),
                            permissions=list(PERMISSIONS.keys()) if user_data.get('is_super', False) else []
                        ))
                    return users
                
                # 新格式
                return [User(**user) for user in data]
        except Exception:
            return []
    
    def _save_users(self, users: list):
        """保存用户数据"""
        try:
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump([user.to_dict() for user in users], f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存用户数据失败: {e}")
    
    def authenticate(self, username: str, password: str) -> User:
        """验证用户身份"""
        users = self._load_users()
        password_hash = encrypt_password(password)
        
        for user in users:
            if user.username == username and user.password_hash == password_hash:
                return user
        
        return None
    
    def get_user(self, username: str) -> User:
        """获取用户信息"""
        users = self._load_users()
        for user in users:
            if user.username == username:
                return user
        return None
    
    def add_user(self, username: str, password: str, is_super: bool = False, permissions: list = None):
        """添加用户"""
        users = self._load_users()
        
        # 检查用户名是否已存在
        for user in users:
            if user.username == username:
                raise ValueError(f"用户名 '{username}' 已存在")
        
        # 创建新用户
        new_user = User(
            username=username,
            password_hash=encrypt_password(password),
            is_super=is_super,
            permissions=permissions if permissions else []
        )
        
        users.append(new_user)
        self._save_users(users)
    
    def update_user(self, username: str, password: str = None, is_super: bool = None, permissions: list = None):
        """更新用户信息"""
        users = self._load_users()
        found = False
        
        for user in users:
            if user.username == username:
                if password:
                    user.password_hash = encrypt_password(password)
                if is_super is not None:
                    user.is_super = is_super
                if permissions is not None:
                    user.permissions = permissions
                found = True
                break
        
        if not found:
            raise ValueError(f"用户 '{username}' 不存在")
        
        self._save_users(users)
    
    def delete_user(self, username: str):
        """删除用户"""
        if username == 'root':
            raise ValueError("不能删除管理员账户")
        
        users = self._load_users()
        original_count = len(users)
        target_username = username.strip().lower()
        users = [user for user in users if user.username.strip().lower() != target_username]
        
        if len(users) == original_count:
            raise ValueError(f"用户 '{username}' 不存在")
        
        self._save_users(users)
    
    def get_all_users(self) -> list:
        """获取所有用户"""
        return self._load_users()
    
    def get_all_permissions(self) -> dict:
        """获取所有权限定义"""
        return PERMISSIONS
    
    def change_password(self, username: str, old_password: str, new_password: str):
        """修改密码"""
        user = self.authenticate(username, old_password)
        if not user:
            raise ValueError("原密码不正确")
        
        self.update_user(username, password=new_password)
