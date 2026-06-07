import os
import json
from utils.common import get_app_data_dir


class ConfigManager:
    """配置管理类"""
    
    def __init__(self):
        self.app_data_dir = get_app_data_dir()
        self.config_file = os.path.join(self.app_data_dir, 'config.json')
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        default_config = {
            'preset_names': ['南', '南微信', '南6叔', '南少', '武', '甲', '乙', '丙', '丁'],
            'lend_keywords': ['借', '欠', '要', '急用', '充', '买', '发', '补'],
            'receive_keywords': ['还', '收回', '还款', '还钱', '回'],
            'excluded_keywords': ['微信', '农行', '饭卡', '儿子', '丹', '懒', '农信'],
            'confidence_threshold': 0.6
        }
        
        if not os.path.exists(self.config_file):
            self.config = default_config
            self._save_config()
        else:
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
                # 合并新的默认配置项
                for key, value in default_config.items():
                    if key not in self.config:
                        self.config[key] = value
                self._save_config()
            except Exception as e:
                print(f"加载配置失败: {e}")
                self.config = default_config
    
    def _save_config(self):
        """保存配置文件"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存配置失败: {e}")
    
    @property
    def preset_names(self):
        """获取预设姓名列表"""
        return self.config.get('preset_names', [])
    
    @preset_names.setter
    def preset_names(self, names):
        """设置预设姓名列表"""
        self.config['preset_names'] = names
        self._save_config()
    
    @property
    def lend_keywords(self):
        """获取借出关键词列表"""
        return self.config.get('lend_keywords', [])
    
    @property
    def receive_keywords(self):
        """获取收回关键词列表"""
        return self.config.get('receive_keywords', [])
    
    @property
    def excluded_keywords(self):
        """获取排除关键词列表（不应该作为人名的词）"""
        return self.config.get('excluded_keywords', [])
    
    @property
    def confidence_threshold(self):
        """获取置信度阈值"""
        return self.config.get('confidence_threshold', 0.6)
    
    def add_preset_name(self, name):
        """添加预设姓名"""
        if name and name not in self.preset_names:
            self.config['preset_names'].append(name)
            self._save_config()
            return True
        return False
    
    def remove_preset_name(self, name):
        """移除预设姓名"""
        if name in self.preset_names:
            self.config['preset_names'].remove(name)
            self._save_config()
            return True
        return False
    
    def update_keywords(self, keyword_type, keywords):
        """更新关键词列表"""
        if keyword_type in ['lend_keywords', 'receive_keywords', 'excluded_keywords']:
            self.config[keyword_type] = keywords
            self._save_config()
            return True
        return False