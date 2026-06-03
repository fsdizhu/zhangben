import { Hono } from 'hono';
import { verifyToken } from '../utils/auth';
import { Database } from '../db';

export function createConfigRoutes(db: Database): Hono {
  const app = new Hono();

  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload) {
      return c.json({ success: false, message: '无效的token' }, 401);
    }

    c.set('user', payload);
    await next();
  };

  const superUserMiddleware = async (c: any, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user || !user.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }
    await next();
  };

  app.use('*', authMiddleware);

  app.get('/', async (c) => {
    try {
      const config = await db.getConfig();
      return c.json({ success: true, config });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.put('/preset-names', async (c) => {
    try {
      const user = c.get('user');
      if (!user || !user.is_super) {
        return c.json({ success: false, message: '权限不足' }, 403);
      }

      const { names } = await c.req.json<{ names: string[] }>();
      
      if (!Array.isArray(names)) {
        return c.json({ success: false, message: 'names必须是数组' }, 400);
      }

      const validNames = names.filter(name => name && typeof name === 'string').map(name => name.trim());
      await db.updateConfig('preset_names', validNames);
      
      return c.json({ success: true, message: '预设人名更新成功' });
    } catch (error) {
      return c.json({ success: false, message: '更新失败' }, 500);
    }
  });

  app.put('/keywords', async (c) => {
    try {
      const user = c.get('user');
      if (!user || !user.is_super) {
        return c.json({ success: false, message: '权限不足' }, 403);
      }

      const { lend_keywords, receive_keywords, excluded_keywords } = await c.req.json<{
        lend_keywords?: string[];
        receive_keywords?: string[];
        excluded_keywords?: string[];
      }>();

      if (lend_keywords !== undefined) {
        if (!Array.isArray(lend_keywords)) {
          return c.json({ success: false, message: 'lend_keywords必须是数组' }, 400);
        }
        const valid = lend_keywords.filter(k => k && typeof k === 'string').map(k => k.trim());
        await db.updateConfig('lend_keywords', valid);
      }

      if (receive_keywords !== undefined) {
        if (!Array.isArray(receive_keywords)) {
          return c.json({ success: false, message: 'receive_keywords必须是数组' }, 400);
        }
        const valid = receive_keywords.filter(k => k && typeof k === 'string').map(k => k.trim());
        await db.updateConfig('receive_keywords', valid);
      }

      if (excluded_keywords !== undefined) {
        if (!Array.isArray(excluded_keywords)) {
          return c.json({ success: false, message: 'excluded_keywords必须是数组' }, 400);
        }
        const valid = excluded_keywords.filter(k => k && typeof k === 'string').map(k => k.trim());
        await db.updateConfig('excluded_keywords', valid);
      }

      return c.json({ success: true, message: '关键词更新成功' });
    } catch (error) {
      return c.json({ success: false, message: '更新失败' }, 500);
    }
  });

  app.put('/threshold', async (c) => {
    try {
      const user = c.get('user');
      if (!user || !user.is_super) {
        return c.json({ success: false, message: '权限不足' }, 403);
      }

      const { threshold } = await c.req.json<{ threshold: number }>();
      
      if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
        return c.json({ success: false, message: '阈值必须在0到1之间' }, 400);
      }

      await db.updateConfig('confidence_threshold', threshold);
      return c.json({ success: true, message: '阈值更新成功' });
    } catch (error) {
      return c.json({ success: false, message: '更新失败' }, 500);
    }
  });

  return app;
}
