import { Hono } from 'hono';
import { verifyToken } from '../utils/auth';
import { Database } from '../db';
import { exportToCSV, exportToExcel, exportByPersonToExcel } from '../utils/export';

export function createExportRoutes(db: Database): Hono {
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

  app.get('/csv', async (c) => {
    try {
      const entries = await db.getAllEntries();
      const csvContent = exportToCSV(entries);
      
      return c.body(csvContent, 200, {
        'Content-Type': 'text/csv; charset=UTF-8',
        'Content-Disposition': `attachment; filename="account_data_${new Date().toISOString().slice(0, 10)}.csv"`,
      });
    } catch (error) {
      return c.json({ success: false, message: '导出失败' }, 500);
    }
  });

  app.get('/excel', async (c) => {
    try {
      const entries = await db.getAllEntries();
      const excelBuffer = exportToExcel(entries);
      
      return c.body(excelBuffer, 200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="account_data_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      });
    } catch (error) {
      return c.json({ success: false, message: '导出失败' }, 500);
    }
  });

  app.get('/excel/person', async (c) => {
    try {
      const entries = await db.getAllEntries();
      const excelBuffer = exportByPersonToExcel(entries);
      
      return c.body(excelBuffer, 200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="account_data_by_person_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      });
    } catch (error) {
      return c.json({ success: false, message: '导出失败' }, 500);
    }
  });

  return app;
}
