import os
import sys
import hashlib
from datetime import datetime


def get_app_data_dir():
    """获取应用程序数据目录"""
    if getattr(sys, 'frozen', False):
        app_data_dir = os.path.join(os.path.expanduser("~"), "AppData", "Local", "账本管理工具")
    else:
        app_data_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    if not os.path.exists(app_data_dir):
        os.makedirs(app_data_dir)
    
    return app_data_dir


def encrypt_password(password):
    """SHA256加密密码"""
    return hashlib.sha256(password.encode()).hexdigest()


def validate_date_format(date_str):
    """验证日期格式是否为YYYYMMDD或YYYYMM00（00表示日期不详）"""
    if not isinstance(date_str, str) or len(date_str) != 8 or not date_str.isdigit():
        return False
    try:
        year = int(date_str[:4])
        month = int(date_str[4:6])
        day = int(date_str[6:8])
        # 允许日期为00表示不详
        if day == 0 and month >= 1 and month <= 12:
            return True
        # 正常日期校验
        datetime.strptime(date_str, "%Y%m%d")
        return True
    except (ValueError, IndexError):
        return False


def validate_amount(amount):
    """验证金额是否为正整数"""
    try:
        amount = int(amount)
        return amount > 0
    except (ValueError, TypeError):
        return False


def format_date(date_str):
    """将YYYYMMDD格式转换为YYYY-MM-DD"""
    if validate_date_format(date_str):
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    return date_str


def generate_backup_filename(prefix="account_backup"):
    """生成带时间戳的备份文件名"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f"{prefix}_{timestamp}.csv"