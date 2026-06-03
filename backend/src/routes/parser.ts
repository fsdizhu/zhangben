import { Hono } from 'hono';
import { verifyToken } from '../utils/auth';
import { Database } from '../db';
import { TextParser } from '../utils/parser';
import { ParseRequest, ParsedEntry } from '../types';

export function createParserRoutes(db: Database): Hono {
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

  app.post('/parse', async (c) => {
    try {
      const { text, threshold } = await c.req.json<ParseRequest>();
      
      if (!text) {
        return c.json({ success: false, message: '文本内容不能为空' }, 400);
      }

      const config = await db.getConfig();
      const parser = new TextParser(config);
      
      const result = parser.parseWithAlert(text, threshold);
      
      return c.json({
        success: true,
        high_confidence: result.high_confidence,
        low_confidence: result.low_confidence,
        threshold: result.threshold,
      });
    } catch (error) {
      return c.json({ success: false, message: '解析失败' }, 500);
    }
  });

  app.post('/parse-and-save', async (c) => {
    try {
      const { text, threshold, save_low_confidence = false } = await c.req.json<{
        text: string;
        threshold?: number;
        save_low_confidence?: boolean;
      }>();
      
      if (!text) {
        return c.json({ success: false, message: '文本内容不能为空' }, 400);
      }

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
    } catch (error) {
      return c.json({ success: false, message: '解析或保存失败' }, 500);
    }
  });

  return app;
}
