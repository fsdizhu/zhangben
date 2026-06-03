import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Database } from './db';
import { CacheService } from './utils/cache';
import { encryptPassword, generateToken } from './utils/auth.js';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from './types';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  CACHE?: KVNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// 数据库实例
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

// 验证当前用户密码
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

    // 获取用户
    const user = await db.getUser(username);
    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    // 验证密码
    const hashedPassword = encryptPassword(password);
    if (user.password !== hashedPassword) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    // 生成 token
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
  const { verifyToken } = await import('./utils/auth.js');
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
  const { verifyToken } = await import('./utils/auth.js');
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
  const { verifyToken } = await import('./utils/auth.js');
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
    
    // 清除缓存
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
    
    // 验证密码
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    await db.updateEntry(id, { date, person, description, amount, type });
    
    // 清除缓存
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
    
    // 验证密码
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    await db.deleteEntry(id);
    
    // 清除缓存
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
        { ttl: 3600 } // 1 hour
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
        { ttl: 300 } // 5 minutes
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
        { ttl: 300 } // 5 minutes
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
    
    // 验证密码
    const user = c.get('user');
    const isPasswordValid = await verifyCurrentUserPassword(c.env, user.username, password);
    if (!isPasswordValid) {
      return c.json({ success: false, message: '密码错误' }, 403);
    }
    
    // 清空账目
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

export default app;
