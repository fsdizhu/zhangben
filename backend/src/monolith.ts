/**
 * 账本管理工具 API - 单文件版本
 * 合并所有模块，便于复制粘贴部署到 Cloudflare Workers
 */

// ============ 类型定义 ============
interface User {
  username: string;
  password: string;
  is_super: boolean;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}

type Permission = 'add_entry' | 'edit_entry' | 'delete_entry' | 'import_entry' | 'clear_database';

const ALL_PERMISSIONS: Permission[] = ['add_entry', 'edit_entry', 'delete_entry', 'import_entry', 'clear_database'];

const PERMISSION_LABELS: Record<Permission, string> = {
  add_entry: '增加账目',
  edit_entry: '修改账目',
  delete_entry: '删除账目',
  import_entry: '导入账目',
  clear_database: '清空数据库',
};

interface Entry {
  id: number;
  date: string;
  person: string;
  description?: string;
  amount: number;
  type: '借出' | '收回';
  created_at?: string;
  updated_at?: string;
}

interface ParsedEntry {
  date: string;
  person: string;
  description: string;
  amount: number;
  type: '借出' | '收回';
  confidence: number;
  confidence_details: {
    date: number;
    amount: number;
    person: number;
    type: number;
  };
}

interface Config {
  preset_names: string[];
  lend_keywords: string[];
  receive_keywords: string[];
  excluded_keywords: string[];
  confidence_threshold: number;
}

interface EntryRequest {
  date: string;
  person: string;
  description?: string;
  amount: number;
  type: '借出' | '收回';
}

// ============ 认证工具函数 ============
function encryptPassword(password: string): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(password).digest('hex');
}

function generateToken(secret: string, username: string, is_super: boolean): string {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    username,
    is_super,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    iat: Math.floor(Date.now() / 1000),
  })));
  const signature = base64UrlEncode(
    require('node:crypto').createHash('sha256').update(`${header}.${payload}.${secret}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

function verifyToken(secret: string, token: string): { username: string; is_super: boolean } | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    
    const expectedSignature = base64UrlEncode(
      require('node:crypto').createHash('sha256').update(`${header}.${payload}.${secret}`).digest()
    );
    
    if (signature !== expectedSignature) return null;
    
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    
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
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateSuperCode(adminPassword: string): string {
  const now = new Date();
  const currentTime = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`;
  return adminPassword + currentTime;
}

const DEFAULT_CONFIG = {
  preset_names: ['南', '南微信', '南6叔', '南少', '武雄', '甲', '乙', '丙', '丁'],
  lend_keywords: ['借', '欠', '要', '急用', '充', '买', '发', '补'],
  receive_keywords: ['还', '收回', '还款', '还钱', '回'],
  excluded_keywords: ['微信', '农行', '饭卡', '儿子', '丹', '懒', '农信'],
  confidence_threshold: 0.6,
};

function getDefaultUser(adminPassword: string) {
  return {
    username: 'root',
    password: encryptPassword(adminPassword),
    is_super: true,
  };
}

// ============ 缓存服务 ============
interface CacheOptions {
  ttl?: number;
}

class CacheService {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const ttl = options.ttl || 300;

    try {
      const cached = await this.kv.get(key, 'json');
      if (cached !== null) {
        return cached as T;
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    const data = await fetcher();

    try {
      await this.kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
    } catch (error) {
      console.warn('Cache write error:', error);
    }

    return data;
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.kv.list({ prefix: pattern });
      for (const key of keys.keys) {
        await this.kv.delete(key.name);
      }
    } catch (error) {
      console.warn('Cache invalidate error:', error);
    }
  }

  buildStatsKey(startDate?: string, endDate?: string, persons?: string[]): string {
    const personKey = persons ? persons.join(',') : 'all';
    return `stats:${startDate || 'all'}:${endDate || 'all'}:${personKey}`;
  }

  buildStatsPersonKey(startDate?: string, endDate?: string, persons?: string[]): string {
    const personKey = persons ? persons.join(',') : 'all';
    return `stats-person:${startDate || 'all'}:${endDate || 'all'}:${personKey}`;
  }

  buildPersonsKey(): string {
    return 'persons:list';
  }
}

// ============ 文本解析器 ============
class TextParser {
  private config: Config;

  constructor(config?: Config) {
    this.config = config || DEFAULT_CONFIG;
  }

  setConfig(config: Config) {
    this.config = config;
  }

  private extractDate(text: string): [string | null, string] {
    const datePattern = /(\d{8})/;
    const match = text.match(datePattern);
    if (match) {
      const dateStr = match[1];
      try {
        new Date(dateStr.substring(0, 4), parseInt(dateStr.substring(4, 6), 10) - 1, parseInt(dateStr.substring(6, 8), 10));
        return [dateStr, text.replace(dateStr, '', 1).trim()];
      } catch {
        return [null, text];
      }
    }
    return [null, text];
  }

  private extractAmount(text: string): [number | null, string] {
    const patterns = [/(\d+)(?:元)?$/, /(\d+)(?=[^\d]*(?:元|$))/, /(\d+)/];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const amount = parseInt(match[1], 10);
          if (amount > 0) {
            return [amount, text];
          }
        } catch {
          continue;
        }
      }
    }
    return [null, text];
  }

  private extractPerson(text: string): [string, number] {
    const { preset_names, excluded_keywords } = this.config;
    
    for (const name of [...preset_names].sort((a, b) => b.length - a.length)) {
      if (text.startsWith(name)) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.6 : 0.9;
        return [name, confidence];
      }
    }

    const keywords = [...this.config.lend_keywords, ...this.config.receive_keywords, ...excluded_keywords];
    const keywordPattern = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`^([\\u4e00-\\u9fa5\\d]+?)(?=${keywordPattern}|元|$)`);
    
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name && name.length <= 6) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.4 : 0.7;
        return [name, confidence];
      }
    }

    const simpleMatch = text.match(/^[\u4e00-\u9fa5\d]{1,6}/);
    if (simpleMatch) {
      const name = simpleMatch[0].trim();
      if (name) {
        const containsExcluded = excluded_keywords.some(kw => name.includes(kw));
        const confidence = containsExcluded ? 0.3 : 0.5;
        return [name, confidence];
      }
    }

    return ['其他', 0.2];
  }

  private determineType(text: string): [string, number] {
    const { lend_keywords, receive_keywords } = this.config;

    const lendCount = lend_keywords.filter(kw => text.includes(kw)).length;
    const receiveCount = receive_keywords.filter(kw => text.includes(kw)).length;

    if (text.includes('少回') || text.includes('说明还')) {
      return ['借出', 0.9];
    }

    if (receiveCount > lendCount) {
      if (text.includes('还') && text.includes('借')) {
        if (text.indexOf('还') < text.indexOf('借')) {
          return ['收回', 0.9];
        } else {
          return ['借出', 0.8];
        }
      }
      return ['收回', Math.min(0.9, 0.7 + receiveCount * 0.1)];
    } else if (lendCount > 0) {
      return ['借出', Math.min(0.9, 0.7 + lendCount * 0.1)];
    } else if (receiveCount > 0) {
      return ['收回', Math.min(0.9, 0.7 + receiveCount * 0.1)];
    }

    return ['借出', 0.5];
  }

  parseLine(line: string): ParsedEntry | null {
    line = line.trim();
    if (!line) {
      return null;
    }

    const result: ParsedEntry = {
      date: '',
      person: '',
      description: line,
      amount: 0,
      type: '借出',
      confidence: 0.0,
      confidence_details: { date: 0, amount: 0, person: 0, type: 0 },
    };

    const [date, afterDate] = this.extractDate(line);
    if (date) {
      result.date = date;
      result.confidence_details.date = 1.0;
    } else {
      result.date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      result.confidence_details.date = 0.3;
    }

    const [amount] = this.extractAmount(afterDate || line);
    if (!amount) {
      return null;
    }
    result.amount = amount;
    result.confidence_details.amount = 1.0;

    const [person, personConfidence] = this.extractPerson(afterDate || line);
    result.person = person;
    result.confidence_details.person = personConfidence;

    const [entryType, typeConfidence] = this.determineType(afterDate || line);
    result.type = entryType as '借出' | '收回';
    result.confidence_details.type = typeConfidence;

    const weights = { date: 0.2, amount: 0.3, person: 0.3, type: 0.2 };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const weightedSum = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (result.confidence_details[key as keyof typeof result.confidence_details] * weight);
    }, 0);
    result.confidence = weightedSum / totalWeight;

    return result;
  }

  parse(text: string): ParsedEntry[] {
    const lines = text.trim().split('\n');
    const results: ParsedEntry[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const parsed = this.parseLine(trimmedLine);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  }

  parseWithAlert(text: string, threshold?: number) {
    const effectiveThreshold = threshold ?? this.config.confidence_threshold;
    const results = this.parse(text);

    const highConfidence = results.filter(r => r.confidence >= effectiveThreshold);
    const lowConfidence = results.filter(r => r.confidence < effectiveThreshold);

    return {
      high_confidence: highConfidence,
      low_confidence: lowConfidence,
      threshold: effectiveThreshold,
    };
  }
}

// ============ 数据库类 ============
class Database {
  private db: D1Database;
  private jwtSecret: string;
  private adminPassword: string;
  public initialized: boolean = false;

  constructor(db: D1Database, jwtSecret: string, adminPassword: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
    this.adminPassword = adminPassword;
  }

  getJwtSecret(): string {
    return this.jwtSecret;
  }

  getAdminPassword(): string {
    return this.adminPassword;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    await this.createTables();
    await this.createIndexes();
    await this.initDefaultUsers();
    await this.initDefaultConfig();
    this.initialized = true;
  }

  private async createIndexes(): Promise<void> {
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person);
      CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
    `);
  }

  private async createTables(): Promise<void> {
    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, is_super INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
    );

    try {
      await this.db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'");
    } catch {
      // 字段可能已存在
    }

    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, person TEXT NOT NULL, description TEXT, amount INTEGER NOT NULL, type TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
    );

    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))"
    );
  }

  private async initDefaultUsers(): Promise<void> {
    const defaultUser = getDefaultUser(this.adminPassword);
    const existing = await this.db.prepare('SELECT * FROM users WHERE username = ?').bind(defaultUser.username).first();
    if (!existing) {
      await this.db.prepare(
        'INSERT INTO users (username, password, is_super) VALUES (?, ?, ?)'
      ).bind(defaultUser.username, defaultUser.password, defaultUser.is_super ? 1 : 0).run();
    }
  }

  private async initDefaultConfig(): Promise<void> {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      const existing = await this.db.prepare('SELECT * FROM config WHERE key = ?').bind(key).first();
      if (!existing) {
        await this.db.prepare('INSERT INTO config (key, value) VALUES (?, ?)')
          .bind(key, JSON.stringify(value)).run();
      }
    }
  }

  async getUser(username: string): Promise<User | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!result) return null;
    return {
      ...result,
      permissions: typeof result.permissions === 'string' ? JSON.parse(result.permissions) : []
    } as User;
  }

  async addUser(username: string, password: string, is_super: boolean, permissions: string[] = []): Promise<void> {
    const encryptedPassword = encryptPassword(password);
    await this.db.prepare(
      'INSERT INTO users (username, password, is_super, permissions) VALUES (?, ?, ?, ?)'
    ).bind(username, encryptedPassword, is_super ? 1 : 0, JSON.stringify(permissions)).run();
  }

  async updateUser(username: string, password?: string, is_super?: boolean, permissions?: string[]): Promise<void> {
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (password) {
      updates.push('password = ?');
      params.push(encryptPassword(password));
    }
    if (is_super !== undefined) {
      updates.push('is_super = ?');
      params.push(is_super ? 1 : 0);
    }
    if (permissions !== undefined) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(permissions));
    }

    if (updates.length > 0) {
      params.push(username);
      await this.db.prepare(
        "UPDATE users SET " + updates.join(', ') + ", updated_at = datetime('now') WHERE username = ?"
      ).bind(...params).run();
    }
  }

  async deleteUser(username: string): Promise<void> {
    await this.db.prepare('DELETE FROM users WHERE username = ?').bind(username).run();
  }

  async getAllUsers(): Promise<User[]> {
    const results = await this.db.prepare('SELECT * FROM users ORDER BY username').all();
    return results.results.map((user: any) => ({
      ...user,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : []
    })) as User[];
  }

  async addEntry(entry: Omit<Entry, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.prepare(
      'INSERT INTO entries (date, person, description, amount, type) VALUES (?, ?, ?, ?, ?)'
    ).bind(entry.date, entry.person, entry.description || null, entry.amount, entry.type).run();
    
    return Number(result.meta.last_row_id);
  }

  async updateEntry(id: number, entry: Partial<Omit<Entry, 'id'>>): Promise<void> {
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (entry.date) { updates.push('date = ?'); params.push(entry.date); }
    if (entry.person) { updates.push('person = ?'); params.push(entry.person); }
    if (entry.description !== undefined) { updates.push('description = ?'); params.push(entry.description); }
    if (entry.amount) { updates.push('amount = ?'); params.push(entry.amount); }
    if (entry.type) { updates.push('type = ?'); params.push(entry.type); }

    if (updates.length > 0) {
      params.push(id);
      await this.db.prepare(
        "UPDATE entries SET " + updates.join(', ') + ", updated_at = datetime('now') WHERE id = ?"
      ).bind(...params).run();
    }
  }

  async deleteEntry(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
  }

  async clearEntries(): Promise<void> {
    await this.db.exec('DELETE FROM entries');
  }

  async getEntry(id: number): Promise<Entry | null> {
    const result = await this.db.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first();
    return result as Entry | null;
  }

  async getAllEntries(): Promise<Entry[]> {
    const results = await this.db.prepare('SELECT * FROM entries ORDER BY id DESC').all();
    return results.results as Entry[];
  }

  async getEntriesFiltered(startDate?: string, endDate?: string, persons?: string[]): Promise<Entry[]> {
    let query = 'SELECT * FROM entries';
    const params: string[] = [];
    const conditions: string[] = [];

    if (startDate && endDate) {
      conditions.push('date >= ? AND date <= ?');
      params.push(startDate, endDate);
    }

    if (persons && persons.length > 0) {
      const placeholders = persons.map(() => '?').join(',');
      conditions.push(`person IN (${placeholders})`);
      params.push(...persons);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY id DESC';

    const results = await this.db.prepare(query).bind(...params).all();
    return results.results as Entry[];
  }

  async getEntriesPaginated(
    sortBy: string = 'id',
    order: string = 'desc',
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: Entry[]; total: number }> {
    const validSortFields = ['id', 'date', 'person', 'amount', 'type'];
    const validOrder = ['asc', 'desc'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'id';
    const dir = validOrder.includes(order.toLowerCase()) ? order.toLowerCase() : 'desc';
    
    const countResult = await this.db.prepare('SELECT COUNT(*) as total FROM entries').first() as { total: number };
    const total = countResult.total || 0;
    
    const results = await this.db.prepare(
      `SELECT * FROM entries ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
    
    return { entries: results.results as Entry[], total };
  }

  async getEntriesByType(type: string): Promise<Entry[]> {
    const results = await this.db.prepare('SELECT * FROM entries WHERE type = ? ORDER BY id DESC').bind(type).all();
    return results.results as Entry[];
  }

  async getEntriesByDateRange(startDate: string, endDate: string): Promise<Entry[]> {
    const results = await this.db.prepare(
      'SELECT * FROM entries WHERE date >= ? AND date <= ? ORDER BY id DESC'
    ).bind(startDate, endDate).all();
    return results.results as Entry[];
  }

  async getEntriesByPerson(person: string): Promise<Entry[]> {
    const results = await this.db.prepare('SELECT * FROM entries WHERE person LIKE ? ORDER BY id DESC').bind('%' + person + '%').all();
    return results.results as Entry[];
  }

  async getAllPersons(): Promise<string[]> {
    const results = await this.db.prepare('SELECT DISTINCT person FROM entries ORDER BY person').all();
    return (results.results as { person: string }[]).map(r => r.person);
  }

  async getConfig(): Promise<Config> {
    const results = await this.db.prepare('SELECT key, value FROM config').all();
    const config: Partial<Config> = {};
    
    for (const row of results.results as { key: string; value: string }[]) {
      config[row.key as keyof Config] = JSON.parse(row.value);
    }
    
    return {
      preset_names: config.preset_names || DEFAULT_CONFIG.preset_names,
      lend_keywords: config.lend_keywords || DEFAULT_CONFIG.lend_keywords,
      receive_keywords: config.receive_keywords || DEFAULT_CONFIG.receive_keywords,
      excluded_keywords: config.excluded_keywords || DEFAULT_CONFIG.excluded_keywords,
      confidence_threshold: config.confidence_threshold ?? DEFAULT_CONFIG.confidence_threshold,
    };
  }

  async updateConfig(key: keyof Config, value: unknown): Promise<void> {
    await this.db.prepare(
      "UPDATE config SET value = ?, updated_at = datetime('now') WHERE key = ?"
    ).bind(JSON.stringify(value), key).run();
  }

  async getStatistics(startDate?: string, endDate?: string, persons?: string[]): Promise<{
    total_entries: number;
    total_lend: number;
    total_receive: number;
    balance: number;
  }> {
    let query = 'SELECT COUNT(*) as total_entries, SUM(CASE WHEN type = \'借出\' THEN amount ELSE 0 END) as total_lend, SUM(CASE WHEN type = \'收回\' THEN amount ELSE 0 END) as total_receive FROM entries';
    const params: string[] = [];
    const conditions: string[] = [];

    if (startDate && endDate) {
      conditions.push('date >= ? AND date <= ?');
      params.push(startDate, endDate);
    }

    if (persons && persons.length > 0) {
      const placeholders = persons.map(() => '?').join(',');
      conditions.push(`person IN (${placeholders})`);
      params.push(...persons);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.db.prepare(query).bind(...params).first() as {
      total_entries: number;
      total_lend: number;
      total_receive: number;
    };

    return {
      total_entries: result.total_entries || 0,
      total_lend: result.total_lend || 0,
      total_receive: result.total_receive || 0,
      balance: (result.total_receive || 0) - (result.total_lend || 0),
    };
  }

  async getStatisticsByPerson(startDate?: string, endDate?: string, persons?: string[]): Promise<{ [person: string]: { '借出': number; '收回': number } }> {
    let query = 'SELECT person, type, SUM(amount) as total FROM entries';
    const params: string[] = [];
    const conditions: string[] = [];

    if (startDate && endDate) {
      conditions.push('date >= ? AND date <= ?');
      params.push(startDate, endDate);
    }

    if (persons && persons.length > 0) {
      const placeholders = persons.map(() => '?').join(',');
      conditions.push(`person IN (${placeholders})`);
      params.push(...persons);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY person, type';

    const results = await this.db.prepare(query).bind(...params).all();
    const stats: { [person: string]: { '借出': number; '收回': number } } = {};

    for (const row of results.results as { person: string; type: string; total: number }[]) {
      if (!stats[row.person]) {
        stats[row.person] = { '借出': 0, '收回': 0 };
      }
      stats[row.person][row.type as '借出' | '收回'] = row.total || 0;
    }

    return stats;
  }

  async searchEntries(query: string, limit: number = 100): Promise<Entry[]> {
    const searchTerm = `%${query}%`;
    const results = await this.db.prepare(`
      SELECT * FROM entries 
      WHERE person LIKE ? OR description LIKE ? OR date LIKE ?
      ORDER BY date DESC
      LIMIT ?
    `).bind(searchTerm, searchTerm, searchTerm, limit).all();
    
    return results.results as Entry[];
  }
}

// ============ Hono 应用 ============
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  CACHE?: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

let dbInstance: Database | null = null;
let cacheInstance: CacheService | null = null;

function getDb(env: Env): Database {
  if (!dbInstance) {
    dbInstance = new Database(env.DB, env.JWT_SECRET, env.ADMIN_PASSWORD);
  }
  return dbInstance;
}

function getCache(env: Env): CacheService | null {
  if (!cacheInstance && env.CACHE) {
    cacheInstance = new CacheService(env.CACHE);
  }
  return cacheInstance;
}

async function invalidateStatsCache(cache: CacheService | null) {
  if (cache) {
    await cache.invalidate('stats:');
    await cache.invalidate('stats-person:');
    await cache.invalidate('persons:');
  }
}

async function verifyCurrentUserPassword(env: Env, username: string, password: string): Promise<boolean> {
  const db = getDb(env);
  const user = await db.getUser(username);
  if (!user) return false;
  return user.password === encryptPassword(password);
}

// CORS
app.use('*', cors({
  origin: '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 根路由
app.get('/', (c) => {
  return c.json({ success: true, message: '账本管理工具 API' });
});

app.get('/health', (c) => {
  return c.json({ success: true, status: 'ok' });
});

// ============ 认证路由 ============
app.post('/api/auth/login', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const body = await c.req.json();
    const { username, password } = body || {};
    
    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
    }

    const user = await db.getUser(username);
    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    const hashedPassword = encryptPassword(password);
    if (user.password !== hashedPassword) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    const token = generateToken(c.env.JWT_SECRET, user.username, user.is_super);
    
    return c.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        username: user.username,
        is_super: user.is_super,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error?.message || error);
    return c.json({ success: false, message: '登录失败: ' + (error?.message || String(error)) }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  return c.json({ success: true, message: '退出成功' });
});

app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ success: false, message: '未授权' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(c.env.JWT_SECRET, token);
  
  if (!payload) {
    return c.json({ success: false, message: '无效的token' }, 401);
  }

  return c.json({
    success: true,
    user: {
      username: payload.username,
      is_super: payload.is_super,
    },
  });
});

// 认证中间件
const authRequired = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ success: false, message: '未授权' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(c.env.JWT_SECRET, token);
  if (!payload) {
    return c.json({ success: false, message: '无效的token' }, 401);
  }
  c.set('user', payload);
  await next();
};

app.use('/api/entries/*', authRequired);
app.use('/api/parser/*', authRequired);
app.use('/api/config/*', authRequired);
app.use('/api/export/*', authRequired);
app.use('/api/admin/*', authRequired);

// 超级管理员权限中间件
const superAdminRequired = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ success: false, message: '未授权' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(c.env.JWT_SECRET, token);
  if (!payload || !payload.is_super) {
    return c.json({ success: false, message: '权限不足' }, 403);
  }
  c.set('user', payload);
  await next();
};

// ============ 用户管理 ============
app.get('/api/auth/users', superAdminRequired, async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const users = await db.getAllUsers();
    return c.json({
      success: true,
      users: users.map((u: any) => ({ 
        username: u.username, 
        is_super: u.is_super,
        permissions: u.permissions || [],
      })),
    });
  } catch (error: any) {
    console.error('Get users error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.get('/api/auth/permissions', superAdminRequired, async (c) => {
  return c.json({
    success: true,
    permissions: ALL_PERMISSIONS.map(p => ({
      key: p,
      label: PERMISSION_LABELS[p],
    })),
  });
});

app.post('/api/auth/users', superAdminRequired, async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const { username, password, is_super = false, permissions = [] } = await c.req.json();
    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
    }
    
    const existing = await db.getUser(username);
    if (existing) {
      return c.json({ success: false, message: '用户名已存在' }, 400);
    }
    
    await db.addUser(username, password, is_super, permissions);
    return c.json({ success: true, message: '用户添加成功' });
  } catch (error: any) {
    console.error('Add user error:', error?.message || error);
    return c.json({ success: false, message: '添加失败' }, 500);
  }
});

app.put('/api/auth/users/:username', superAdminRequired, async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const username = c.req.param('username');
    
    if (username === 'root') {
      return c.json({ success: false, message: '不能修改超级用户' }, 400);
    }
    
    const { password, is_super, permissions } = await c.req.json();
    await db.updateUser(username, password, is_super, permissions);
    return c.json({ success: true, message: '用户更新成功' });
  } catch (error: any) {
    console.error('Update user error:', error?.message || error);
    return c.json({ success: false, message: '更新失败' }, 500);
  }
});

app.delete('/api/auth/users/:username', superAdminRequired, async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const username = c.req.param('username');
    
    if (username === 'root') {
      return c.json({ success: false, message: '不能删除超级用户' }, 400);
    }
    
    const existing = await db.getUser(username);
    if (!existing) {
      return c.json({ success: false, message: '用户不存在' }, 400);
    }
    
    await db.deleteUser(username);
    return c.json({ success: true, message: '用户删除成功' });
  } catch (error: any) {
    console.error('Delete user error:', error?.message || error);
    return c.json({ success: false, message: '删除失败' }, 500);
  }
});

// ============ 账目路由 ============
app.get('/api/entries', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const sortBy = c.req.query('sortBy') || 'id';
    const order = (c.req.query('order') || 'desc').toLowerCase() as 'asc' | 'desc';
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    
    const { entries, total } = await db.getEntriesPaginated(
      sortBy,
      order,
      isNaN(limit) ? 50 : limit,
      isNaN(offset) ? 0 : offset
    );
    
    return c.json({ success: true, entries, total });
  } catch (error: any) {
    console.error('Get entries error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.post('/api/entries', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    const { date, person, description, amount, type } = await c.req.json();
    if (!date || !person || !amount) {
      return c.json({ success: false, message: '日期、人物和金额不能为空' }, 400);
    }
    const id = await db.addEntry({ date, person, description: description || '', amount: Math.floor(amount), type });
    
    await invalidateStatsCache(cache);
    
    return c.json({ success: true, message: '添加成功', id });
  } catch (error: any) {
    console.error('Add entry error:', error?.message || error);
    return c.json({ success: false, message: '添加失败' }, 500);
  }
});

app.put('/api/entries/:id', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    
    const id = parseInt(c.req.param('id'), 10);
    const { date, person, description, amount, type, password } = await c.req.json();
    
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    await db.updateEntry(id, { date, person, description, amount, type });
    
    await invalidateStatsCache(cache);
    
    return c.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    console.error('Update entry error:', error?.message || error);
    return c.json({ success: false, message: '更新失败' }, 500);
  }
});

app.delete('/api/entries/:id', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    
    const id = parseInt(c.req.param('id'), 10);
    const { password } = await c.req.json();
    
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    await db.deleteEntry(id);
    
    await invalidateStatsCache(cache);
    
    return c.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('Delete entry error:', error?.message || error);
    return c.json({ success: false, message: '删除失败' }, 500);
  }
});

app.get('/api/entries/persons', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    
    if (cache) {
      const persons = await cache.getOrSet(
        cache.buildPersonsKey(),
        () => db.getAllPersons(),
        { ttl: 3600 }
      );
      return c.json({ success: true, persons });
    } else {
      const persons = await db.getAllPersons();
      return c.json({ success: true, persons });
    }
  } catch (error: any) {
    console.error('Get persons error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.get('/api/entries/stats', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;
    const personsParam = c.req.query('persons');
    const persons = personsParam ? personsParam.split(',') : undefined;
    
    if (cache) {
      const cacheKey = cache.buildStatsKey(startDate, endDate, persons);
      const stats = await cache.getOrSet(
        cacheKey,
        () => db.getStatistics(startDate, endDate, persons),
        { ttl: 300 }
      );
      return c.json({ success: true, stats });
    } else {
      const stats = await db.getStatistics(startDate, endDate, persons);
      return c.json({ success: true, stats });
    }
  } catch (error: any) {
    console.error('Get stats error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.get('/api/entries/stats/person', async (c) => {
  try {
    const db = getDb(c.env);
    const cache = getCache(c.env);
    await db.init();
    
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;
    const personsParam = c.req.query('persons');
    const persons = personsParam ? personsParam.split(',') : undefined;
    
    if (cache) {
      const cacheKey = cache.buildStatsPersonKey(startDate, endDate, persons);
      const stats = await cache.getOrSet(
        cacheKey,
        () => db.getStatisticsByPerson(startDate, endDate, persons),
        { ttl: 300 }
      );
      return c.json({ success: true, stats });
    } else {
      const stats = await db.getStatisticsByPerson(startDate, endDate, persons);
      return c.json({ success: true, stats });
    }
  } catch (error: any) {
    console.error('Get person stats error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.get('/api/entries/search', authRequired, async (c) => {
  try {
    const q = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    
    if (!q) {
      return c.json({ success: false, message: '请提供搜索关键词' }, 400);
    }
    
    const db = getDb(c.env);
    await db.init();
    const entries = await db.searchEntries(q, limit);
    
    return c.json({ success: true, entries });
  } catch (error: any) {
    console.error('Search error:', error?.message || error);
    return c.json({ success: false, message: '搜索失败' }, 500);
  }
});

// ============ 配置路由 ============
app.get('/api/config', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const config = await db.getConfig();
    return c.json({ success: true, config });
  } catch (error: any) {
    console.error('Get config error:', error?.message || error);
    return c.json({ success: false, message: '获取失败' }, 500);
  }
});

app.put('/api/config/preset-names', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const { names } = await c.req.json();
    await db.updateConfig('preset_names', names);
    return c.json({ success: true, message: '预设人名更新成功' });
  } catch (error: any) {
    console.error('Update preset names error:', error?.message || error);
    return c.json({ success: false, message: '更新失败' }, 500);
  }
});

app.put('/api/config/keywords', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const { lend_keywords, receive_keywords, excluded_keywords } = await c.req.json();
    if (lend_keywords) await db.updateConfig('lend_keywords', lend_keywords);
    if (receive_keywords) await db.updateConfig('receive_keywords', receive_keywords);
    if (excluded_keywords) await db.updateConfig('excluded_keywords', excluded_keywords);
    return c.json({ success: true, message: '关键词更新成功' });
  } catch (error: any) {
    console.error('Update keywords error:', error?.message || error);
    return c.json({ success: false, message: '更新失败' }, 500);
  }
});

app.put('/api/config/threshold', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    const { threshold } = await c.req.json();
    await db.updateConfig('confidence_threshold', threshold);
    return c.json({ success: true, message: '阈值更新成功' });
  } catch (error: any) {
    console.error('Update threshold error:', error?.message || error);
    return c.json({ success: false, message: '更新失败' }, 500);
  }
});

// ============ 管理功能路由 ============
app.post('/api/admin/clear-database', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const { password } = await c.req.json();
    
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    await db.clearEntries();
    
    return c.json({ success: true, message: '数据库已清空' });
  } catch (error: any) {
    console.error('Clear database error:', error?.message || error);
    return c.json({ success: false, message: '清空失败' }, 500);
  }
});

// ============ 导出路由 ============
app.get('/api/export/csv', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;
    const personsParam = c.req.query('persons');
    const persons = personsParam ? personsParam.split(',') : undefined;
    
    const entries = await db.getEntriesFiltered(startDate, endDate, persons);
    let csv = '日期,人物,描述,金额,类型\n';
    for (const entry of entries) {
      csv += `${entry.date},${entry.person},"${entry.description || ''}",${entry.amount},${entry.type}\n`;
    }
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="account_data.csv"',
    });
  } catch (error: any) {
    console.error('Export CSV error:', error?.message || error);
    return c.json({ success: false, message: '导出失败' }, 500);
  }
});

app.get('/api/export/excel', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;
    const personsParam = c.req.query('persons');
    const persons = personsParam ? personsParam.split(',') : undefined;
    
    const entries = await db.getEntriesFiltered(startDate, endDate, persons);
    
    let csv = '日期,人物,描述,金额,类型\n';
    for (const entry of entries) {
      csv += `${entry.date},${entry.person},"${entry.description || ''}",${entry.amount},${entry.type}\n`;
    }
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="account_data.csv"',
    });
  } catch (error: any) {
    console.error('Export Excel error:', error?.message || error);
    return c.json({ success: false, message: '导出失败' }, 500);
  }
});

app.get('/api/export/excel-by-person', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const startDate = c.req.query('startDate') || undefined;
    const endDate = c.req.query('endDate') || undefined;
    const personsParam = c.req.query('persons');
    const persons = personsParam ? personsParam.split(',') : undefined;
    
    const entries = await db.getEntriesFiltered(startDate, endDate, persons);
    
    const entriesByPerson: { [person: string]: typeof entries } = {};
    for (const entry of entries) {
      if (!entriesByPerson[entry.person]) {
        entriesByPerson[entry.person] = [];
      }
      entriesByPerson[entry.person].push(entry);
    }
    
    let csv = '';
    const allPersons = Object.keys(entriesByPerson).sort();
    
    for (const person of allPersons) {
      csv += `=== ${person} ===\n`;
      csv += '日期,人物,描述,金额,类型\n';
      for (const entry of entriesByPerson[person]) {
        csv += `${entry.date},${entry.person},"${entry.description || ''}",${entry.amount},${entry.type}\n`;
      }
      csv += '\n';
    }
    
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="account_data_by_person.csv"',
    });
  } catch (error: any) {
    console.error('Export by person error:', error?.message || error);
    return c.json({ success: false, message: '导出失败' }, 500);
  }
});

// ============ 导入路由 ============
app.post('/api/import/csv', async (c) => {
  try {
    const db = getDb(c.env);
    await db.init();
    
    const { data } = await c.req.json();
    
    if (!data || !Array.isArray(data)) {
      return c.json({ success: false, message: '无效的数据格式' }, 400);
    }

    let imported = 0;
    let failed = 0;

    for (const row of data) {
      try {
        const { date, person, description, amount, type } = row;
        
        if (!date || !person || !amount || !type) {
          failed++;
          continue;
        }

        await db.addEntry({
          date: String(date),
          person: String(person),
          description: description ? String(description) : '',
          amount: parseInt(amount, 10),
          type: String(type),
        });
        imported++;
      } catch {
        failed++;
      }
    }

    return c.json({
      success: true,
      message: `成功导入 ${imported} 条，失败 ${failed} 条`,
      imported,
      failed,
    });
  } catch (error: any) {
    console.error('Import CSV error:', error?.message || error);
    return c.json({ success: false, message: '导入失败' }, 500);
  }
});

// ============ 解析路由 ============
app.post('/api/parser/parse', authRequired, async (c) => {
  try {
    const { text, threshold } = await c.req.json();
    
    if (!text) {
      return c.json({ success: false, message: '文本内容不能为空' }, 400);
    }

    const db = getDb(c.env);
    await db.init();
    const config = await db.getConfig();
    const parser = new TextParser(config);
    
    const result = parser.parseWithAlert(text, threshold);
    
    return c.json({
      success: true,
      high_confidence: result.high_confidence,
      low_confidence: result.low_confidence,
      threshold: result.threshold,
    });
  } catch (error: any) {
    console.error('Parse error:', error?.message || error);
    return c.json({ success: false, message: '解析失败' }, 500);
  }
});

app.post('/api/parser/parse-and-save', authRequired, async (c) => {
  try {
    const { text, threshold, save_low_confidence = false } = await c.req.json();
    
    if (!text) {
      return c.json({ success: false, message: '文本内容不能为空' }, 400);
    }

    const db = getDb(c.env);
    await db.init();
    const config = await db.getConfig();
    const parser = new TextParser(config);
    
    const result = parser.parseWithAlert(text, threshold);
    
    const entriesToSave: ParsedEntry[] = save_low_confidence 
      ? [...result.high_confidence, ...result.low_confidence]
      : result.high_confidence;

    for (const entry of entriesToSave) {
      await db.addEntry({
        date: entry.date,
        person: entry.person,
        description: entry.description,
        amount: entry.amount,
        type: entry.type,
      });
    }

    return c.json({
      success: true,
      message: `成功保存 ${entriesToSave.length} 条账目`,
      saved_count: entriesToSave.length,
      high_count: result.high_confidence.length,
      low_count: result.low_confidence.length,
    });
  } catch (error: any) {
    console.error('Parse and save error:', error?.message || error);
    return c.json({ success: false, message: '解析或保存失败' }, 500);
  }
});

export default app;
