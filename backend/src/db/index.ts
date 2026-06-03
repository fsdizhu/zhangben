import { D1Database } from '@cloudflare/workers-types';
import { User, Entry, Config } from '../types';
import { DEFAULT_CONFIG, getDefaultUser, encryptPassword } from '../utils/auth';

export class Database {
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
    // 创建 users 表
    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, is_super INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
    );

    // 添加 permissions 字段（兼容旧表）
    try {
      await this.db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'");
    } catch {
      // 字段可能已存在，忽略错误
    }

    // 创建 entries 表
    await this.db.exec(
      "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, person TEXT NOT NULL, description TEXT, amount INTEGER NOT NULL, type TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
    );

    // 创建 config 表
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

    if (entry.date) {
      updates.push('date = ?');
      params.push(entry.date);
    }
    if (entry.person) {
      updates.push('person = ?');
      params.push(entry.person);
    }
    if (entry.description !== undefined) {
      updates.push('description = ?');
      params.push(entry.description);
    }
    if (entry.amount) {
      updates.push('amount = ?');
      params.push(entry.amount);
    }
    if (entry.type) {
      updates.push('type = ?');
      params.push(entry.type);
    }

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
    // 验证排序字段
    const validSortFields = ['id', 'date', 'person', 'amount', 'type'];
    const validOrder = ['asc', 'desc'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'id';
    const dir = validOrder.includes(order.toLowerCase()) ? order.toLowerCase() : 'desc';
    
    // 获取总数
    const countResult = await this.db.prepare('SELECT COUNT(*) as total FROM entries').first() as { total: number };
    const total = countResult.total || 0;
    
    // 获取分页数据
    const results = await this.db.prepare(
      `SELECT * FROM entries ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
    
    return {
      entries: results.results as Entry[],
      total
    };
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
