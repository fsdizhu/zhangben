import { Hono } from 'hono';
import { verifyToken } from '../utils/auth';
import { Database } from '../db';
import { EntryRequest, Entry } from '../types';

export function createEntriesRoutes(db: Database): Hono {
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

    await next();
  };

  app.use('*', authMiddleware);

  app.get('/', async (c) => {
    try {
      const sortBy = c.req.query('sortBy') || 'id';
      const order = c.req.query('order') || 'desc';
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);
      
      const { entries, total } = await db.getEntriesPaginated(
        sortBy,
        order,
        isNaN(limit) ? 50 : limit,
        isNaN(offset) ? 0 : offset
      );
      
      return c.json({ success: true, entries, total });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id)) {
      return c.json({ success: false, message: '无效的ID' }, 400);
    }

    try {
      const entry = await db.getEntry(id);
      if (!entry) {
        return c.json({ success: false, message: '账目不存在' }, 404);
      }
      return c.json({ success: true, entry });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.post('/', async (c) => {
    try {
      const { date, person, description, amount, type } = await c.req.json<EntryRequest>();
      
      if (!date || !person || !amount) {
        return c.json({ success: false, message: '日期、人物和金额不能为空' }, 400);
      }

      if (date.length !== 8 || !/^\d+$/.test(date)) {
        return c.json({ success: false, message: '日期格式不正确，应为YYYYMMDD' }, 400);
      }

      if (typeof amount !== 'number' || amount <= 0) {
        return c.json({ success: false, message: '金额必须是正整数' }, 400);
      }

      if (type !== '借出' && type !== '收回') {
        return c.json({ success: false, message: '类型必须是借出或收回' }, 400);
      }

      const id = await db.addEntry({
        date,
        person,
        description: description || '',
        amount: Math.floor(amount),
        type,
      });

      return c.json({ success: true, message: '添加成功', id });
    } catch (error) {
      return c.json({ success: false, message: '添加失败' }, 500);
    }
  });

  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id)) {
      return c.json({ success: false, message: '无效的ID' }, 400);
    }

    try {
      const { date, person, description, amount, type } = await c.req.json<Partial<EntryRequest>>();
      
      const updates: Partial<Entry> = {};
      
      if (date) {
        if (date.length !== 8 || !/^\d+$/.test(date)) {
          return c.json({ success: false, message: '日期格式不正确，应为YYYYMMDD' }, 400);
        }
        updates.date = date;
      }
      
      if (person) {
        updates.person = person;
      }
      
      if (description !== undefined) {
        updates.description = description;
      }
      
      if (amount !== undefined) {
        if (typeof amount !== 'number' || amount <= 0) {
          return c.json({ success: false, message: '金额必须是正整数' }, 400);
        }
        updates.amount = Math.floor(amount);
      }
      
      if (type) {
        if (type !== '借出' && type !== '收回') {
          return c.json({ success: false, message: '类型必须是借出或收回' }, 400);
        }
        updates.type = type;
      }

      await db.updateEntry(id, updates);
      return c.json({ success: true, message: '更新成功' });
    } catch (error) {
      return c.json({ success: false, message: '更新失败' }, 500);
    }
  });

  app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    
    if (isNaN(id)) {
      return c.json({ success: false, message: '无效的ID' }, 400);
    }

    try {
      const entry = await db.getEntry(id);
      if (!entry) {
        return c.json({ success: false, message: '账目不存在' }, 404);
      }

      await db.deleteEntry(id);
      return c.json({ success: true, message: '删除成功' });
    } catch (error) {
      return c.json({ success: false, message: '删除失败' }, 500);
    }
  });

  app.get('/filter/type/:type', async (c) => {
    const type = c.req.param('type');
    
    if (type !== '借出' && type !== '收回') {
      return c.json({ success: false, message: '类型必须是借出或收回' }, 400);
    }

    try {
      const entries = await db.getEntriesByType(type);
      return c.json({ success: true, entries });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/filter/date', async (c) => {
    const startDate = c.req.query('start');
    const endDate = c.req.query('end');
    
    if (!startDate || !endDate) {
      return c.json({ success: false, message: '请提供开始和结束日期' }, 400);
    }

    if (startDate.length !== 8 || !/^\d+$/.test(startDate)) {
      return c.json({ success: false, message: '开始日期格式不正确' }, 400);
    }

    if (endDate.length !== 8 || !/^\d+$/.test(endDate)) {
      return c.json({ success: false, message: '结束日期格式不正确' }, 400);
    }

    try {
      const entries = await db.getEntriesByDateRange(startDate, endDate);
      return c.json({ success: true, entries });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/filter/person', async (c) => {
    const person = c.req.query('person');
    
    if (!person) {
      return c.json({ success: false, message: '请提供人名' }, 400);
    }

    try {
      const entries = await db.getEntriesByPerson(person);
      return c.json({ success: true, entries });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/persons', async (c) => {
    try {
      const persons = await db.getAllPersons();
      return c.json({ success: true, persons });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/stats', async (c) => {
    const startDate = c.req.query('start');
    const endDate = c.req.query('end');

    try {
      const stats = await db.getStatistics(startDate || undefined, endDate || undefined);
      return c.json({ success: true, stats });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/stats/person', async (c) => {
    const startDate = c.req.query('start');
    const endDate = c.req.query('end');

    try {
      const stats = await db.getStatisticsByPerson(startDate || undefined, endDate || undefined);
      return c.json({ success: true, stats });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  return app;
}
