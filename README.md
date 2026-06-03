# Zhangben - 账本管理工具

一个功能完善的账目管理工具，支持借出/收回账目记录、文本解析、数据统计和导出功能。

## 功能特性

- **用户认证**：支持多用户登录、密码加密、超级管理员权限
- **账目管理**：新增、编辑、删除、筛选账目记录
- **智能解析**：自动从自然文本中提取日期、金额、人名和类型
- **数据统计**：实时统计借出、收回、结余金额
- **数据导出**：支持Excel和CSV格式导出
- **配置管理**：可配置预设姓名、关键词和置信度阈值

## 项目结构

```
.
├── main.py                 # Python GUI 入口
├── data_manager.py         # 数据管理模块
├── text_parser.py          # 文本解析模块
├── excel_exporter.py       # Excel导出模块
├── user_auth.py            # 用户认证模块
├── config.py               # 配置管理模块
├── utils/
│   └── common.py           # 通用工具函数
├── gui/
│   ├── login_window.py     # 登录窗口
│   └── main_window.py      # 主窗口
├── backend/                # Cloudflare Workers 后端
│   ├── src/
│   │   ├── routes/         # API路由
│   │   ├── db/             # 数据库操作
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 类型定义
│   └── package.json
└── frontend/               # React 前端
    ├── src/
    │   ├── components/     # UI组件
    │   ├── api/            # API调用
    │   └── context/        # React Context
    └── package.json
```

## 技术栈

### Python GUI 版
- Python 3.x
- Tkinter (GUI框架)
- SQLite3 (数据库)
- openpyxl (Excel导出)
- pandas (CSV处理)

### 后端 API 版
- TypeScript
- Cloudflare Workers
- Cloudflare D1 (数据库)

### 前端 Web 版
- React 18
- TypeScript
- Vite
- TailwindCSS 3

## 快速开始

### Python GUI 版

```bash
# 安装依赖
pip install openpyxl pandas

# 运行程序
python main.py
```

默认管理员账号：
- 用户名：`root`
- 密码：`Fs0753@0753`

### 后端 API 版

```bash
cd backend
npm install
npm run dev    # 本地开发
npm run deploy # 部署到 Cloudflare
```

### 前端 Web 版

```bash
cd frontend
npm install
npm run dev    # 开发模式
npm run build  # 生产构建
```

## 使用说明

### 账目录入

1. 在左侧面板输入日期（YYYYMMDD格式）
2. 输入人物名称
3. 输入金额（正整数）
4. 选择类型：借出或收回
5. 填写描述（可选）
6. 点击"添加账目"保存

### 文本解析

工具支持从自然文本中自动解析账目信息，例如：
- "张三借500元" → 解析为：张三，借出，500
- "李四还300" → 解析为：李四，收回，300

### 数据导出

支持导出为：
- Excel格式（`.xlsx`）：带格式和合计统计
- CSV格式（`.csv`）：纯数据格式

### 超级管理员功能

超级用户可访问配置菜单：
- 管理预设人名：配置自动识别的人名列表
- 管理关键词：配置借出/收回关键词
- 管理用户：添加、删除普通用户

## 配置说明

配置文件位于用户数据目录下的 `config.json`：

```json
{
  "preset_names": ["张三", "李四", "王五"],
  "lend_keywords": ["借", "欠", "要", "急用"],
  "receive_keywords": ["还", "收回", "还款"],
  "excluded_keywords": ["微信", "支付宝"],
  "confidence_threshold": 0.6
}
```

## 核心模块说明

### 1. UserAuth
用户认证模块，管理用户登录、密码验证和用户管理。

### 2. DataManager
数据管理模块，封装SQLite数据库操作，支持事务和自动备份。

### 3. TextParser
文本解析模块，使用规则引擎从自然文本中提取账目信息，支持置信度评估。

### 4. ExcelExporter
Excel导出模块，生成带格式的专业报表，支持按人名分组导出。

## 许可证

MIT License