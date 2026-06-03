import { createHash } from 'node:crypto';

export function encryptPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function generateToken(secret: string, username: string, is_super: boolean): string {
  // 简单 JWT 实现
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    username,
    is_super,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    iat: Math.floor(Date.now() / 1000),
  })));
  const signature = base64UrlEncode(
    createHash('sha256').update(`${header}.${payload}.${secret}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(secret: string, token: string): { username: string; is_super: boolean } | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    
    const expectedSignature = base64UrlEncode(
      createHash('sha256').update(`${header}.${payload}.${secret}`).digest()
    );
    
    if (signature !== expectedSignature) return null;
    
    // 使用 TextDecoder 解码 base64
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    
    // 检查过期时间
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return {
      username: decoded.username,
      is_super: decoded.is_super,
    };
  } catch {
    return null;
  }
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  // 恢复标准 base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // 添加 padding
  while (base64.length % 4) {
    base64 += '=';
  }
  // 解码
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSuperCode(adminPassword: string): string {
  const now = new Date();
  const currentTime = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  return adminPassword + currentTime;
}

export const DEFAULT_CONFIG = {
  preset_names: ['南', '南微信', '南6叔', '南少', '武雄', '甲', '乙', '丙', '丁'],
  lend_keywords: ['借', '欠', '要', '急用', '充', '买', '发', '补'],
  receive_keywords: ['还', '收回', '还款', '还钱', '回'],
  excluded_keywords: ['微信', '农行', '饭卡', '儿子', '丹', '懒', '农信'],
  confidence_threshold: 0.6,
};

export function getDefaultUser(adminPassword: string) {
  return {
    username: 'root',
    password: encryptPassword(adminPassword),
    is_super: true,
  };
}

export function validateDate(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 8 || !/^\d+$/.test(dateStr)) {
    return false;
  }
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return false;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

export function validateAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && Number.isInteger(amount);
}
