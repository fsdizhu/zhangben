# 账本管理工具 - Cloudflare 迁移计划

## 一、项目概述

原项目是一个基于 Python Tkinter 的桌面账本管理工具，需要转换为可部署在 Cloudflare 上的 Web 应用。

### 原功能分析

| 功能模块 | 核心功能 | 状态 |
|---------|---------|------|
| 用户认证 | 登录、密码修改、重置、用户管理 | 已实现 |
| 账目管理 | 添加、编辑、删除、查询、筛选 | 已实现 |
| 文本解析 | 自动识别账目信息 | 已实现 |
| 数据导出 | Excel导出、CSV导出 | 已实现 |
| 配置管理 | 预设人名、关键词管理 | 待实现 |
| 统计信息 | 总览和按人统计 | 已实现 |

### 当前项目状态

**已完成的文件：**
- 后端：所有API路由（auth、entries、parser、config、export）
- 前端：LoginPage、Sidebar、EntryForm、EntryList、ExportPanel、ParserPanel、StatsPanel
- 认证上下文、API封装、类型定义

**待完成的文件：**
- 前端：App.tsx、main.tsx、index.html、全局样式
- 前端：ConfigPanel（配置管理）、UserPanel（用户管理）

## 二、技术选型

### 后端技术栈
- **框架**: Hono (轻量、高性能，专为 Cloudflare Workers 设计)
- **数据库**: Cloudflare D1 (SQLite 兼容，Serverless 数据库)
- **认证**: JWT (JSON Web Token) + Cookie
- **密码加密**: SHA-256

### 前端技术栈
- **框架**: React 18 + Vite
- **UI样式**: TailwindCSS 3
- **状态管理**: React Context + useState
- **图标**: Lucide React

## 三、文件结构设计

```
├── backend/                    # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts           # 入口文件 ✓
│   │   ├── routes/            # API 路由 ✓
│   │   │   ├── auth.ts        # 用户认证路由 ✓
│   │   │   ├── entries.ts     # 账目管理路由 ✓
│   │   │   ├── parser.ts      # 文本解析路由 ✓
│   │   │   ├── config.ts      # 配置管理路由 ✓
│   │   │   └── export.ts      # 数据导出路由 ✓
│   │   ├── utils/             # 工具函数 ✓
│   │   ├── types/             # TypeScript 类型定义 ✓
│   │   └── db/                # 数据库操作 ✓
│   ├── package.json ✓
│   └── wrangler.toml          # Cloudflare 配置 ✓

└── frontend/                   # React 前端
    ├── src/
    │   ├── components/        # 组件
    │   │   ├── Sidebar.tsx    # 左侧功能按钮栏 ✓
    │   │   ├── LoginPage.tsx  # 登录页面 ✓
    │   │   ├── EntryForm.tsx  # 账目输入表单 ✓
    │   │   ├── EntryList.tsx  # 账目列表 ✓
    │   │   ├── StatsPanel.tsx # 统计面板 ✓
    │   │   ├── ParserPanel.tsx # 文本解析面板 ✓
    │   │   ├── ExportPanel.tsx # 数据导出面板 ✓
    │   │   ├── ConfigPanel.tsx # 配置管理面板 ✗
    │   │   └── UserPanel.tsx  # 用户管理面板 ✗
    │   ├── context/           # Context ✓
    │   ├── api/               # API 调用封装 ✓
    │   ├── types/             # 类型定义 ✓
    │   ├── App.tsx            # 主应用组件 ✗
    │   ├── main.tsx           # 入口文件 ✗
    │   └── index.css          # 全局样式 ✗
    ├── index.html             # HTML模板 ✗
    ├── package.json ✓
    ├── vite.config.ts ✓
    ├── tailwind.config.js ✓
    └── postcss.config.js ✓
```

## 四、API 接口设计

### 4.1 用户认证接口

| 方法 | 路径 | 功能 | 需要认证 |
|-----|------|------|---------|
| POST | /api/auth/login | 用户登录 | 否 |
| POST | /api/auth/logout | 用户登出 | 是 |
| POST | /api/auth/change-password | 修改密码 | 是 |
| POST | /api/auth/reset-password | 重置密码 | 否 |
| GET | /api/auth/me | 获取当前用户 | 是 |
| GET | /api/auth/users | 获取用户列表 | 是（超级用户） |
| POST | /api/auth/users | 添加用户 | 是（超级用户） |
| PUT | /api/auth/users/:username | 更新用户 | 是（超级用户） |
| DELETE | /api/auth/users/:username | 删除用户 | 是（超级用户） |

### 4.2 账目管理接口

| 方法 | 路径 | 功能 | 需要认证 |
|-----|------|------|---------|
| GET | /api/entries | 获取账目列表 | 是 |
| POST | /api/entries | 添加新账目 | 是 |
| GET | /api/entries/:id | 获取单条账目 | 是 |
| PUT | /api/entries/:id | 更新账目 | 是 |
| DELETE | /api/entries/:id | 删除账目 | 是 |
| GET | /api/entries/filter/type/:type | 按类型筛选 | 是 |
| GET | /api/entries/filter/date | 按日期筛选 | 是 |
| GET | /api/entries/stats | 获取统计信息 | 是 |

### 4.3 文本解析接口

| 方法 | 路径 | 功能 | 需要认证 |
|-----|------|------|---------|
| POST | /api/parser/parse | 解析文本账目 | 是 |
| POST | /api/parser/parse-and-save | 解析并保存 | 是 |

### 4.4 数据导出接口

| 方法 | 路径 | 功能 | 需要认证 |
|-----|------|------|---------|
| GET | /api/export/csv | 导出 CSV | 是 |
| GET | /api/export/excel | 导出 Excel | 是 |

### 4.5 配置管理接口

| 方法 | 路径 | 功能 | 需要认证 |
|-----|------|------|---------|
| GET | /api/config | 获取配置 | 是 |
| PUT | /api/config/preset-names | 更新预设人名 | 是（超级用户） |
| PUT | /api/config/keywords | 更新关键词 | 是（超级用户） |
| PUT | /api/config/threshold | 更新阈值 | 是（超级用户） |

## 五、前端页面与组件设计

### 5.1 页面结构

**登录页 (Login)**
- 用户名输入框
- 密码输入框
- 登录按钮
- 忘记密码链接

**主面板 (Dashboard)**
- 左侧固定功能按钮栏（Sidebar）
- 右侧主内容区

### 5.2 左侧功能按钮栏

| 按钮 | 功能 | 图标 | 权限 |
|-----|------|------|------|
| 账目录入 | 切换到输入表单 | PlusCircle | 所有用户 |
| 账目列表 | 显示账目列表 | List | 所有用户 |
| 文本解析 | 批量解析文本 | FileText | 所有用户 |
| 数据导出 | 导出Excel/CSV | Download | 所有用户 |
| 统计信息 | 显示统计面板 | BarChart3 | 所有用户 |
| 配置管理 | 管理预设人名和关键词 | Settings | 超级用户 |
| 用户管理 | 管理系统用户 | Users | 超级用户 |
| 修改密码 | 修改当前密码 | Lock | 所有用户 |
| 退出登录 | 安全退出 | LogOut | 所有用户 |

## 六、部署方案

### 6.1 后端部署

1. **安装依赖**
```bash
cd backend
npm install
```

2. **配置 D1 数据库**
```bash
npx wrangler d1 create account-book-db
```

3. **更新 wrangler.toml**
```toml
[[d1_databases]]
binding = "DB"
database_name = "account-book-db"
database_id = "<your-database-id>"

[vars]
JWT_SECRET = "<your-jwt-secret>"
ADMIN_PASSWORD = "<your-admin-password>"
```

4. **部署到 Cloudflare**
```bash
npx wrangler deploy
```

### 6.2 前端部署

1. **安装依赖**
```bash
cd frontend
npm install
```

2. **构建生产版本**
```bash
npm run build
```

3. **部署到 Cloudflare Pages**
```bash
npx wrangler pages deploy dist --project-name=account-book-frontend
```

### 6.3 环境变量配置

| 变量名 | 说明 | 示例值 |
|-------|------|-------|
| JWT_SECRET | JWT 签名密钥 | 随机生成的32位字符串 |
| DATABASE_ID | D1 数据库 ID | 从 wrangler 配置获取 |

## 七、转换任务清单

| 序号 | 任务 | 状态 |
|-----|------|------|
| 1 | 创建前端入口文件 (main.tsx) | 待执行 |
| 2 | 创建主应用组件 (App.tsx) | 待执行 |
| 3 | 创建 index.html | 待执行 |
| 4 | 创建全局样式 (index.css) | 待执行 |
| 5 | 创建配置管理组件 (ConfigPanel.tsx) | 待执行 |
| 6 | 创建用户管理组件 (UserPanel.tsx) | 待执行 |
| 7 | 安装前端依赖 | 待执行 |
| 8 | 构建前端项目 | 待执行 |
| 9 | 配置 Cloudflare D1 数据库 | 待执行 |
| 10 | 部署后端到 Cloudflare Workers | 待执行 |
| 11 | 部署前端到 Cloudflare Pages | 待执行 |

---

## 附录：原功能按钮与新UI映射

| 原按钮 | 新位置 | 说明 |
|-------|-------|------|
| 添加账目 | 左侧按钮栏 → 账目录入 | 点击后显示输入表单 |
| 清空 | 输入表单内 | 重置表单内容 |
| 编辑 | 账目列表操作列 | 点击后弹出编辑表单 |
| 删除 | 账目列表操作列 | 点击后确认删除 |
| 刷新 | 账目列表顶部 | 重新加载数据 |
| 筛选借出 | 账目列表筛选区 | 筛选按钮 |
| 筛选收回 | 账目列表筛选区 | 筛选按钮 |
| 显示全部 | 账目列表筛选区 | 清除筛选 |
| 导出Excel | 左侧按钮栏 → 数据导出 | 导出功能面板 |
| 导出CSV | 左侧按钮栏 → 数据导出 | 导出功能面板 |
| 管理预设人名 | 左侧按钮栏 → 配置管理 | 超级用户可见 |
| 管理关键词 | 左侧按钮栏 → 配置管理 | 超级用户可见 |
| 管理用户 | 左侧按钮栏 → 用户管理 | 超级用户可见 |