import { Hono } from 'hono';
import { generateToken, verifyToken, generateSuperCode, encryptPassword } from '../utils/auth';
import { Database } from '../db';
import { LoginRequest, ChangePasswordRequest, ResetPasswordRequest, AddUserRequest, UpdateUserRequest, User, ALL_PERMISSIONS, PERMISSION_LABELS } from '../types';

export function createAuthRoutes(db: Database): Hono {
  const app = new Hono();

  app.post('/login', async (c) => {
    try {
      const { username, password } = await c.req.json<LoginRequest>();
      
      if (!username || !password) {
        return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
      }

      const user = await db.getUser(username);
      if (!user) {
        return c.json({ success: false, message: '用户名或密码错误' }, 401);
      }

      if (user.password !== encryptPassword(password)) {
        return c.json({ success: false, message: '用户名或密码错误' }, 401);
      }

      const token = generateToken(db.getJwtSecret(), user.username, user.is_super);
      
      return c.json({
        success: true,
        message: '登录成功',
        token,
        user: {
          username: user.username,
          is_super: user.is_super,
        },
      });
    } catch (error) {
      return c.json({ success: false, message: '登录失败' }, 500);
    }
  });

  app.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload) {
      return c.json({ success: false, message: '无效的token' }, 401);
    }

    return c.json({
      success: true,
      user: {
        username: payload.username as string,
        is_super: payload.is_super as boolean,
      },
    });
  });

  app.post('/logout', async (c) => {
    return c.json({ success: true, message: '退出成功' });
  });

  app.post('/change-password', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload) {
      return c.json({ success: false, message: '无效的token' }, 401);
    }

    try {
      const { old_password, new_password } = await c.req.json<ChangePasswordRequest>();
      
      if (!old_password || !new_password) {
        return c.json({ success: false, message: '密码不能为空' }, 400);
      }

      const user = await db.getUser(payload.username as string);
      if (!user || user.password !== encryptPassword(old_password)) {
        return c.json({ success: false, message: '当前密码错误' }, 400);
      }

      await db.updateUser(payload.username as string, new_password);
      return c.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      return c.json({ success: false, message: '修改失败' }, 500);
    }
  });

  app.post('/reset-password', async (c) => {
    try {
      const { username, super_code, admin_password, new_password } = await c.req.json<ResetPasswordRequest>();
      
      if (!username || !new_password) {
        return c.json({ success: false, message: '用户名和新密码不能为空' }, 400);
      }

      const user = await db.getUser(username);
      if (!user) {
        return c.json({ success: false, message: '用户名不存在' }, 400);
      }

      if (username === 'root') {
        const expectedCode = generateSuperCode(db.getAdminPassword());
        if (super_code !== expectedCode) {
          return c.json({ success: false, message: '超级用户验证码错误' }, 400);
        }
      } else {
        const admin = await db.getUser('root');
        if (!admin || admin.password !== encryptPassword(admin_password || '')) {
          return c.json({ success: false, message: '超级用户密码错误' }, 400);
        }
      }

      await db.updateUser(username, new_password);
      return c.json({ success: true, message: '密码重置成功' });
    } catch (error) {
      return c.json({ success: false, message: '重置失败' }, 500);
    }
  });

  app.get('/users', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload || !payload.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }

    try {
      const users = await db.getAllUsers();
      return c.json({
        success: true,
        users: users.map((u: User) => ({
          username: u.username,
          is_super: u.is_super,
          permissions: u.permissions || [],
        })),
      });
    } catch (error) {
      return c.json({ success: false, message: '获取失败' }, 500);
    }
  });

  app.get('/permissions', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload || !payload.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }

    return c.json({
      success: true,
      permissions: ALL_PERMISSIONS.map(p => ({
        key: p,
        label: PERMISSION_LABELS[p],
      })),
    });
  });

  app.post('/users', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload || !payload.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }

    try {
      const { username, password, is_super = false, permissions = [] } = await c.req.json<AddUserRequest>();
      
      if (!username || !password) {
        return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
      }

      const existing = await db.getUser(username);
      if (existing) {
        return c.json({ success: false, message: '用户名已存在' }, 400);
      }

      await db.addUser(username, password, is_super, permissions);
      return c.json({ success: true, message: '用户添加成功' });
    } catch (error) {
      return c.json({ success: false, message: '添加失败' }, 500);
    }
  });

  app.put('/users/:username', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload || !payload.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }

    const username = c.req.param('username');
    
    if (username === 'root') {
      return c.json({ success: false, message: '不能修改超级用户' }, 400);
    }

    try {
      const { password, is_super, permissions } = await c.req.json<UpdateUserRequest>();
      await db.updateUser(username, password, is_super, permissions);
      return c.json({ success: true, message: '用户更新成功' });
    } catch (error) {
      return c.json({ success: false, message: '更新失败' }, 500);
    }
  });

  app.delete('/users/:username', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ success: false, message: '未授权' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(db.getJwtSecret(), token);
    
    if (!payload || !payload.is_super) {
      return c.json({ success: false, message: '权限不足' }, 403);
    }

    const username = c.req.param('username');
    
    if (username === 'root') {
      return c.json({ success: false, message: '不能删除超级用户' }, 400);
    }

    try {
      const existing = await db.getUser(username);
      if (!existing) {
        return c.json({ success: false, message: '用户不存在' }, 400);
      }

      await db.deleteUser(username);
      return c.json({ success: true, message: '用户删除成功' });
    } catch (error) {
      return c.json({ success: false, message: '删除失败' }, 500);
    }
  });

  return app;
}
