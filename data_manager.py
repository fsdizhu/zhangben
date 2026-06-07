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
        """初始化数据库（包含索引优化）"""
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
                    type TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 创建索引优化查询性能
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_entries_amount ON entries(amount)')
            
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
    
    def load_entries(self, sort_by='date', order='desc', limit=None, offset=0):
        """从数据库加载账目数据（支持排序和分页）"""
        entries = []
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            # 验证排序字段
            valid_sort_fields = ['date', 'person', 'amount', 'type', 'id']
            if sort_by not in valid_sort_fields:
                sort_by = 'date'
            
            # 验证排序方向
            order = 'DESC' if order.lower() == 'desc' else 'ASC'
            
            query = f'SELECT id, date, person, description, amount, type FROM entries ORDER BY {sort_by} {order}'
            
            if limit is not None:
                query += ' LIMIT ? OFFSET ?'
                cursor.execute(query, (limit, offset))
            else:
                cursor.execute(query)
            
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'id': row[0],
                    'date': row[1],
                    'person': row[2],
                    'description': row[3],
                    'amount': row[4],
                    'type': row[5],
                    'input_order': idx + 1 + offset
                })
        except Exception as e:
            print(f"加载数据失败: {e}")
        return entries
    
    def get_total_entries(self):
        """获取总条目数"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM entries')
            result = cursor.fetchone()
            conn.close()
            return result[0] if result else 0
        except Exception as e:
            print(f"获取总数失败: {e}")
            return 0
    
    def search_entries(self, query, fields=None):
        """搜索账目数据（支持多字段搜索）"""
        entries = []
        if not query:
            return self.load_entries()
        
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            # 默认搜索字段
            if not fields:
                fields = ['person', 'description', 'date']
            
            # 构建搜索查询
            conditions = []
            params = []
            
            for field in fields:
                if field in ['person', 'description']:
                    conditions.append(f"{field} LIKE ?")
                    params.append(f'%{query}%')
                elif field == 'date':
                    conditions.append(f"{field} LIKE ?")
                    params.append(f'%{query}%')
                elif field == 'amount':
                    try:
                        amount = int(query)
                        conditions.append(f"{field} = ?")
                        params.append(amount)
                    except ValueError:
                        continue
            
            if not conditions:
                return []
            
            query_str = 'SELECT id, date, person, description, amount, type FROM entries WHERE ' + ' OR '.join(conditions)
            query_str += ' ORDER BY date DESC'
            
            cursor.execute(query_str, params)
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'id': row[0],
                    'date': row[1],
                    'person': row[2],
                    'description': row[3],
                    'amount': row[4],
                    'type': row[5],
                    'input_order': idx + 1
                })
        except Exception as e:
            print(f"搜索数据失败: {e}")
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
        conn = None
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO entries (date, person, description, amount, type)
                VALUES (?, ?, ?, ?, ?)
            ''', (entry['date'], entry['person'], entry['description'], entry['amount'], entry['type']))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            print(f"添加数据失败: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def update_entry(self, entry_id, entry):
        """更新指定ID的账目"""
        self._validate_entry(entry)
        conn = None
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE entries 
                SET date = ?, person = ?, description = ?, amount = ?, type = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (entry['date'], entry['person'], entry['description'], entry['amount'], entry['type'], entry_id))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"更新数据失败: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def delete_entry(self, entry_id):
        """删除指定ID的账目"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('DELETE FROM entries WHERE id = ?', (entry_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"删除数据失败: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def clear_all_entries(self):
        """清空所有账目"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('DELETE FROM entries')
            conn.commit()
            return True
        except Exception as e:
            print(f"清空数据失败: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def query_by_date(self, start_date, end_date):
        """按日期范围查询"""
        if not validate_date_format(start_date) or not validate_date_format(end_date):
            raise ValueError("日期格式必须是YYYYMMDD")
        
        entries = []
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, date, person, description, amount, type 
                FROM entries 
                WHERE date BETWEEN ? AND ? 
                ORDER BY date DESC
            ''', (start_date, end_date))
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'id': row[0],
                    'date': row[1],
                    'person': row[2],
                    'description': row[3],
                    'amount': row[4],
                    'type': row[5],
                    'input_order': idx + 1
                })
        except Exception as e:
            print(f"查询数据失败: {e}")
        return entries
    
    def query_by_person(self, person_name):
        """按人名查询"""
        entries = []
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, date, person, description, amount, type 
                FROM entries 
                WHERE person LIKE ? 
                ORDER BY date DESC
            ''', (f'%{person_name}%',))
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'id': row[0],
                    'date': row[1],
                    'person': row[2],
                    'description': row[3],
                    'amount': row[4],
                    'type': row[5],
                    'input_order': idx + 1
                })
        except Exception as e:
            print(f"查询数据失败: {e}")
        return entries
    
    def query_by_type(self, entry_type):
        """按类型查询"""
        if entry_type not in ['借出', '收回']:
            raise ValueError("类型必须是'借出'或'收回'")
        
        entries = []
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, date, person, description, amount, type 
                FROM entries 
                WHERE type = ? 
                ORDER BY date DESC
            ''', (entry_type,))
            rows = cursor.fetchall()
            conn.close()
            
            for idx, row in enumerate(rows):
                entries.append({
                    'id': row[0],
                    'date': row[1],
                    'person': row[2],
                    'description': row[3],
                    'amount': row[4],
                    'type': row[5],
                    'input_order': idx + 1
                })
        except Exception as e:
            print(f"查询数据失败: {e}")
        return entries
    
    def get_all_persons(self):
        """获取所有已有的人名"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute('SELECT DISTINCT person FROM entries ORDER BY person')
            rows = cursor.fetchall()
            conn.close()
            return [row[0] for row in rows]
        except Exception as e:
            print(f"获取人名失败: {e}")
            return []
    
    def get_statistics(self, start_date=None, end_date=None, persons=None):
        """获取统计信息"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            query = 'SELECT SUM(CASE WHEN type = "借出" THEN amount ELSE 0 END), SUM(CASE WHEN type = "收回" THEN amount ELSE 0 END), COUNT(*) FROM entries'
            params = []
            
            conditions = []
            if start_date and end_date:
                conditions.append('date BETWEEN ? AND ?')
                params.extend([start_date, end_date])
            
            if persons:
                placeholders = ','.join('?' * len(persons))
                conditions.append(f'person IN ({placeholders})')
                params.extend(persons)
            
            if conditions:
                query = query.replace('FROM entries', f'FROM entries WHERE {" AND ".join(conditions)}')
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            conn.close()
            
            total_lend = result[0] if result[0] else 0
            total_receive = result[1] if result[1] else 0
            total_entries = result[2] if result[2] else 0
            
            return {
                'total_entries': total_entries,
                'total_lend': total_lend,
                'total_receive': total_receive,
                'balance': total_receive - total_lend
            }
        except Exception as e:
            print(f"获取统计信息失败: {e}")
            return {'total_entries': 0, 'total_lend': 0, 'total_receive': 0, 'balance': 0}
    
    def get_statistics_by_person(self, start_date=None, end_date=None):
        """按人名统计"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            query = '''
                SELECT person, 
                       SUM(CASE WHEN type = "借出" THEN amount ELSE 0 END) as lend, 
                       SUM(CASE WHEN type = "收回" THEN amount ELSE 0 END) as receive
                FROM entries
            '''
            params = []
            
            conditions = []
            if start_date and end_date:
                conditions.append('date BETWEEN ? AND ?')
                params.extend([start_date, end_date])
            
            if conditions:
                query += f' WHERE {" AND ".join(conditions)}'
            
            query += ' GROUP BY person ORDER BY person'
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            
            stats = {}
            for row in rows:
                stats[row[0]] = {'lend': row[1] if row[1] else 0, 'receive': row[2] if row[2] else 0}
            
            return stats
        except Exception as e:
            print(f"按人名统计失败: {e}")
            return {}
    
    def get_statistics_with_keyword(self, keyword):
        """根据关键词搜索并统计"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            query = '''
                SELECT SUM(CASE WHEN type = "借出" THEN amount ELSE 0 END), 
                       SUM(CASE WHEN type = "收回" THEN amount ELSE 0 END), 
                       COUNT(*) 
                FROM entries 
                WHERE date LIKE ? OR person LIKE ? OR description LIKE ?
            '''
            params = [f'%{keyword}%', f'%{keyword}%', f'%{keyword}%']
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            conn.close()
            
            total_lend = result[0] if result[0] else 0
            total_receive = result[1] if result[1] else 0
            total_entries = result[2] if result[2] else 0
            
            return {
                'total_entries': total_entries,
                'total_lend': total_lend,
                'total_receive': total_receive,
                'balance': total_receive - total_lend
            }
        except Exception as e:
            print(f"关键词统计失败: {e}")
            return {'total_entries': 0, 'total_lend': 0, 'total_receive': 0, 'balance': 0}
    
    def get_statistics_by_person_with_keyword(self, keyword):
        """根据关键词搜索并按人名统计"""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            
            query = '''
                SELECT person, 
                       SUM(CASE WHEN type = "借出" THEN amount ELSE 0 END) as lend, 
                       SUM(CASE WHEN type = "收回" THEN amount ELSE 0 END) as receive
                FROM entries 
                WHERE date LIKE ? OR person LIKE ? OR description LIKE ?
                GROUP BY person ORDER BY person
            '''
            params = [f'%{keyword}%', f'%{keyword}%', f'%{keyword}%']
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            
            stats = {}
            for row in rows:
                stats[row[0]] = {'lend': row[1] if row[1] else 0, 'receive': row[2] if row[2] else 0}
            
            return stats
        except Exception as e:
            print(f"关键词个人统计失败: {e}")
            return {}
    
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
            
            # 根据实际列数分配列名
            col_count = df.shape[1]
            columns = ['date', 'person', 'description', 'amount', 'type', 'input_order']
            if col_count < len(columns):
                # CSV只有5列（无input_order列），截取对应列名
                df.columns = columns[:col_count]
            elif col_count > len(columns):
                # CSV列数超出预期，只取前6列
                df = df.iloc[:, :len(columns)]
                df.columns = columns
            else:
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
