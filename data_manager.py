import os
import sqlite3
import shutil
from datetime import datetime
import pandas as pd
from utils.common import get_app_data_dir, validate_date_format, validate_amount


class DataManager:
    """数据管理类 - 统一封装数据库操作和数据存取"""
    
    def __init__(self):
        self.app_data_dir = get_app_data_dir()
        self.db_file = os.path.join(self.app_data_dir, 'account_data.db')
        self._init_database()
    
    def _init_database(self):
        """初始化数据库"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    person TEXT NOT NULL,
                    description TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    type TEXT NOT NULL
                )
            ''')
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"初始化数据库失败: {e}")
    
    def _validate_entry(self, entry):
        """验证单条账目数据的有效性"""
        required_fields = ['date', 'person', 'description', 'amount', 'type']
        for field in required_fields:
            if field not in entry or entry[field] is None:
                raise ValueError(f"缺少必要字段: {field}")
        
        if not validate_amount(entry['amount']):
            raise ValueError(f"金额必须是正整数，当前值: {entry['amount']}")
        
        if entry['type'] not in ['借出', '收回']:
            raise ValueError(f"类型必须是'借出'或'收回'，当前值: {entry['type']}")
        
        if not validate_date_format(entry['date']):
            raise ValueError(f"日期格式必须是8位数字(YYYYMMDD)，当前值: {entry['date']}")
        
        return True
    
    def _validate_entries(self, entries):
        """批量验证账目数据"""
        for idx, entry in enumerate(entries):
            try:
                self._validate_entry(entry)
            except ValueError as e:
                raise ValueError(f"第 {idx + 1} 条数据验证失败: {e}")
        return True
    
    def load_entries(self):
        """从数据库加载账目数据"""
        entries = []
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('SELECT date, person, description, amount, type FROM entries ORDER BY id')
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'date': row[0],
                    'person': row[1],
                    'description': row[2],
                    'amount': row[3],
                    'type': row[4],
                    'input_order': idx + 1
                })
        except Exception as e:
            print(f"加载数据失败: {e}")
        return entries
    
    def save_entries(self, entries, validate=True):
        """保存账目数据到数据库（带事务支持）"""
        if validate and entries:
            self._validate_entries(entries)
        
        conn = None
        try:
            conn = sqlite3.connect(self.db_file)
            conn.execute('BEGIN TRANSACTION')
            cursor = conn.cursor()
            cursor.execute('DELETE FROM entries')
            
            if entries:
                for entry in entries:
                    cursor.execute('''
                        INSERT INTO entries (date, person, description, amount, type)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (entry['date'], entry['person'], entry['description'], entry['amount'], entry['type']))
            
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"保存数据失败: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def save_entries_atomic(self, entries):
        """原子性保存 - 备份旧数据后再写入"""
        backup_file = None
        if os.path.exists(self.db_file):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = f"{self.db_file}.backup_{timestamp}"
            shutil.copy2(self.db_file, backup_file)
        
        try:
            self.save_entries(entries, validate=True)
        except Exception as e:
            if backup_file and os.path.exists(backup_file):
                shutil.copy2(backup_file, self.db_file)
                os.remove(backup_file)
            raise
    
    def add_entry(self, entry):
        """添加单条账目"""
        self._validate_entry(entry)
        entries = self.load_entries()
        entries.append(entry)
        self.save_entries(entries, validate=False)
        return len(entries)
    
    def update_entry(self, index, entry):
        """更新指定索引的账目"""
        self._validate_entry(entry)
        entries = self.load_entries()
        if 0 <= index < len(entries):
            entries[index] = entry
            self.save_entries(entries, validate=False)
            return True
        return False
    
    def delete_entry(self, index):
        """删除指定索引的账目"""
        entries = self.load_entries()
        if 0 <= index < len(entries):
            deleted = entries.pop(index)
            self.save_entries(entries, validate=False)
            return deleted
        return None
    
    def query_by_date(self, start_date, end_date):
        """按日期范围查询"""
        if not validate_date_format(start_date) or not validate_date_format(end_date):
            raise ValueError("日期格式必须是YYYYMMDD")
        
        entries = self.load_entries()
        return [e for e in entries if start_date <= e['date'] <= end_date]
    
    def query_by_person(self, person_name):
        """按人名查询"""
        entries = self.load_entries()
        return [e for e in entries if person_name in e['person']]
    
    def query_by_type(self, entry_type):
        """按类型查询"""
        if entry_type not in ['借出', '收回']:
            raise ValueError("类型必须是'借出'或'收回'")
        
        entries = self.load_entries()
        return [e for e in entries if e['type'] == entry_type]
    
    def get_all_persons(self):
        """获取所有已有的人名"""
        entries = self.load_entries()
        return sorted(set(entry['person'] for entry in entries))
    
    def get_statistics(self, start_date=None, end_date=None, persons=None):
        """获取统计信息"""
        entries = self.load_entries()
        
        if start_date and end_date:
            entries = [e for e in entries if start_date <= e['date'] <= end_date]
        
        if persons:
            entries = [e for e in entries if e['person'] in persons]
        
        total_lend = sum(e['amount'] for e in entries if e['type'] == '借出')
        total_receive = sum(e['amount'] for e in entries if e['type'] == '收回')
        
        return {
            'total_entries': len(entries),
            'total_lend': total_lend,
            'total_receive': total_receive,
            'balance': total_receive - total_lend
        }
    
    def get_statistics_by_person(self, start_date=None, end_date=None):
        """按人名统计"""
        entries = self.load_entries()
        
        if start_date and end_date:
            entries = [e for e in entries if start_date <= e['date'] <= end_date]
        
        stats = {}
        for entry in entries:
            person = entry['person']
            if person not in stats:
                stats[person] = {'借出': 0, '收回': 0}
            stats[person][entry['type']] += entry['amount']
        
        return stats
    
    def export_to_csv(self, entries, file_path):
        """导出数据到CSV"""
        df = pd.DataFrame(entries)
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
    
    def import_from_csv(self, file_path):
        """从CSV导入数据（带校验）"""
        try:
            encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312']
            df = None
            
            for encoding in encodings:
                try:
                    df = pd.read_csv(file_path, encoding=encoding, header=None)
                    break
                except Exception:
                    continue
            
            if df is None:
                raise ValueError("无法读取CSV文件，请检查文件编码")
            
            if df.empty:
                return []
            
            columns = ['date', 'person', 'description', 'amount', 'type', 'input_order']
            df.columns = columns
            
            entries = df.to_dict('records')
            validated_entries = []
            
            for idx, entry in enumerate(entries):
                try:
                    if isinstance(entry['amount'], float):
                        entry['amount'] = int(entry['amount'])
                    else:
                        entry['amount'] = int(entry['amount'])
                    
                    if not isinstance(entry['date'], str):
                        entry['date'] = str(entry['date'])
                    
                    if not isinstance(entry['type'], str):
                        entry['type'] = str(entry['type'])
                    
                    if 'input_order' in entry and entry['input_order'] is not None:
                        if isinstance(entry['input_order'], float):
                            entry['input_order'] = int(entry['input_order'])
                        else:
                            entry['input_order'] = int(entry['input_order'])
                    
                    self._validate_entry(entry)
                    validated_entries.append(entry)
                except (ValueError, TypeError) as e:
                    print(f"警告: 第 {idx + 1} 条数据格式不正确，已跳过: {e}")
                    continue
            
            return validated_entries
        except Exception as e:
            print(f"导入CSV文件时出错: {e}")
            raise