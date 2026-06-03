import re
from datetime import datetime
from config import ConfigManager


class TextParser:
    """文本解析器 - 使用规则引擎解析账目文本"""
    
    def __init__(self):
        self.config = ConfigManager()
    
    def _extract_date(self, text):
        """从文本中提取日期"""
        # 格式1: 8位数字日期 YYYYMMDD
        date_pattern = r'(\d{8})'
        match = re.search(date_pattern, text)
        if match:
            date_str = match.group(1)
            # 验证日期是否有效
            try:
                datetime.strptime(date_str, "%Y%m%d")
                return date_str, text.replace(date_str, '', 1).strip()
            except ValueError:
                pass
        
        return None, text
    
    def _extract_amount(self, text):
        """从文本中提取金额"""
        # 匹配数字（可能在末尾或关键词后）
        patterns = [
            r'(\d+)(?:元)?$',           # 末尾的数字
            r'(\d+)(?=[^\d]*(?:元|$))', # 数字后可能有元或到末尾
            r'(\d+)',                   # 任意数字
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    amount = int(match.group(1))
                    return amount, text
                except ValueError:
                    continue
        
        return None, text
    
    def _extract_person(self, text):
        """从文本中提取人名（带置信度）"""
        preset_names = self.config.preset_names
        excluded_keywords = self.config.excluded_keywords
        
        # 优先匹配预设姓名（长姓名优先）
        for name in sorted(preset_names, key=len, reverse=True):
            if text.startswith(name):
                # 检查是否包含排除关键词
                contains_excluded = any(kw in name for kw in excluded_keywords)
                confidence = 0.9 if not contains_excluded else 0.6
                return name, confidence
        
        # 尝试从开头提取人名
        # 模式：中文+数字组合，直到遇到关键词
        keywords = self.config.lend_keywords + self.config.receive_keywords + excluded_keywords
        keyword_pattern = '|'.join(re.escape(kw) for kw in keywords)
        pattern = rf'^([\u4e00-\u9fa5\d]+?)(?={keyword_pattern}|元|$)'
        
        match = re.search(pattern, text)
        if match:
            name = match.group(1).strip()
            if name and len(name) <= 6:
                # 检查是否包含排除关键词
                contains_excluded = any(kw in name for kw in excluded_keywords)
                confidence = 0.7 if not contains_excluded else 0.4
                return name, confidence
        
        # 尝试简单模式：开头1-6个中文/数字字符
        match = re.search(r'^([\u4e00-\u9fa5\d]{1,6})', text)
        if match:
            name = match.group(1).strip()
            if name:
                contains_excluded = any(kw in name for kw in excluded_keywords)
                confidence = 0.5 if not contains_excluded else 0.3
                return name, confidence
        
        return '其他', 0.2
    
    def _determine_type(self, text):
        """判断账目类型（借出/收回）带置信度"""
        lend_keywords = self.config.lend_keywords
        receive_keywords = self.config.receive_keywords
        
        lend_count = sum(1 for kw in lend_keywords if kw in text)
        receive_count = sum(1 for kw in receive_keywords if kw in text)
        
        # 特殊情况处理
        if '少回' in text or '说明还' in text:
            return '借出', 0.9
        
        if receive_count > lend_count:
            # "还"字在"借"字之前表示收回
            if '还' in text and '借' in text:
                if text.index('还') < text.index('借'):
                    return '收回', 0.9
                else:
                    return '借出', 0.8
            return '收回', min(0.9, 0.7 + receive_count * 0.1)
        elif lend_count > 0:
            return '借出', min(0.9, 0.7 + lend_count * 0.1)
        elif receive_count > 0:
            return '收回', min(0.9, 0.7 + receive_count * 0.1)
        
        # 默认认为是借出
        return '借出', 0.5
    
    def parse_line(self, line):
        """解析单行文本"""
        line = line.strip()
        if not line:
            return None
        
        result = {
            'date': None,
            'person': None,
            'description': line,
            'amount': None,
            'type': None,
            'confidence': 0.0,
            'confidence_details': {}
        }
        
        # 提取日期
        date, remaining = self._extract_date(line)
        if date:
            result['date'] = date
            result['confidence_details']['date'] = 1.0
        else:
            # 使用当前日期
            result['date'] = datetime.now().strftime("%Y%m%d")
            result['confidence_details']['date'] = 0.3
        
        # 提取金额
        amount, _ = self._extract_amount(remaining)
        if amount:
            result['amount'] = amount
            result['confidence_details']['amount'] = 1.0
        else:
            return None
        
        # 提取人名
        person, person_confidence = self._extract_person(remaining)
        result['person'] = person
        result['confidence_details']['person'] = person_confidence
        
        # 判断类型
        entry_type, type_confidence = self._determine_type(remaining)
        result['type'] = entry_type
        result['confidence_details']['type'] = type_confidence
        
        # 计算综合置信度（加权平均）
        weights = {'date': 0.2, 'amount': 0.3, 'person': 0.3, 'type': 0.2}
        total_weight = sum(weights.values())
        weighted_sum = sum(
            result['confidence_details'].get(key, 0) * weights.get(key, 0)
            for key in weights
        )
        result['confidence'] = weighted_sum / total_weight
        
        return result
    
    def parse(self, text):
        """解析文本（多行）"""
        lines = text.strip().split('\n')
        results = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            parsed = self.parse_line(line)
            if parsed:
                results.append(parsed)
        
        return results
    
    def parse_with_low_confidence_alert(self, text, threshold=None):
        """解析文本并标记低置信度结果"""
        if threshold is None:
            threshold = self.config.confidence_threshold
        
        results = self.parse(text)
        
        # 分离高/低置信度结果
        high_confidence = []
        low_confidence = []
        
        for result in results:
            if result['confidence'] >= threshold:
                high_confidence.append(result)
            else:
                low_confidence.append(result)
        
        return {
            'high_confidence': high_confidence,
            'low_confidence': low_confidence,
            'threshold': threshold
        }


class ParsedEntry:
    """解析结果条目"""
    
    def __init__(self, date, person, description, amount, entry_type, confidence=0.0):
        self.date = date
        self.person = person
        self.description = description
        self.amount = amount
        self.type = entry_type
        self.confidence = confidence
    
    def to_dict(self):
        return {
            'date': self.date,
            'person': self.person,
            'description': self.description,
            'amount': self.amount,
            'type': self.type,
            'confidence': self.confidence
        }
    
    def __repr__(self):
        return f"ParsedEntry(date={self.date}, person={self.person}, amount={self.amount}, type={self.type}, confidence={self.confidence:.2f})"