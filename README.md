# Auto Feedback

一个面向 Z Code 产品反馈的匿名收集与 AI 结构化分析系统。用户可以提交文字反馈和截图，系统将原始反馈写入 MySQL，并异步调用 DashScope Qwen VL 模型生成可检索、可统计的分析结果。

## 功能特性

- 匿名反馈提交：支持问题类型、问题描述、上下文、环境信息和联系方式。
- 图片上传：支持 JPG、JPEG、PNG，默认最多 3 张，单张 5 MB。
- AI 结构化分析：自动归因根因、功能模块、用户意图、流程阶段、严重程度和置信度。
- 反馈看板：前端展示统计摘要、反馈列表和图片预览。
- 管理追踪页：提供 HTML 管理页查看反馈列表与单条分析详情。
- 每日飞书日报：按 Asia/Shanghai 时区每天 09:00 推送前一日反馈概览。
- Docker Compose 部署：内置 MySQL、Node.js 后端、Nginx 前端服务。

## 技术栈

- 前端：Vue 3、Vite、Axios
- 后端：Node.js、Express、mysql2、multer、node-cron
- 数据库：MySQL 8.0，原始数据和 AI 分析结果分库保存
- AI：DashScope OpenAI-compatible Chat Completions API
- 部署：Docker Compose、Nginx

## 项目结构

```text
auto_feedback/
├── backend/                 # Express API 服务
│   ├── src/routes/          # 反馈、统计、管理页面路由
│   ├── src/services/        # AI 分析、飞书推送等服务
│   └── src/utils/           # 数据库连接
├── frontend/                # Vue 3 前端应用
│   ├── src/components/      # 表单、列表、统计组件
│   └── src/utils/api.js     # API 客户端
├── mysql/init.sql           # 数据库和表初始化脚本
├── uploads/                 # Docker 挂载的上传文件目录
├── docker-compose.yml       # 一键部署编排
├── DEPLOYMENT.md            # 部署说明
└── DEBUGGING_PLAYBOOK.md    # 常见问题排查手册
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. 配置环境变量

复制根目录模板：

```bash
cp .env.example .env
```

至少需要配置：

```env
MYSQL_ROOT_PASSWORD=change_me
DB_PASSWORD=change_me
DASHSCOPE_API_KEY=your_dashscope_api_key
FEISHU_WEBHOOK_URL=your_feishu_bot_webhook
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
```

本地开发时，如果 MySQL 运行在宿主机，设置：

```env
DB_HOST=localhost
UPLOAD_DIR=./uploads
```

Docker 部署时，设置：

```env
DB_HOST=mysql
UPLOAD_DIR=/app/uploads
```

### 3. 启动开发服务

后端：

```bash
cd backend
npm run dev
```

前端：

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

访问地址：

- 前端：http://127.0.0.1:5173
- 后端健康检查：http://127.0.0.1:3000/health

## Docker 部署

完整部署步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

最小命令：

```bash
cp .env.example .env
# 编辑 .env 后执行
docker compose build
docker compose up -d
docker compose ps
```

默认端口：

- 前端 Nginx：`80`
- 后端 API：`3000`
- MySQL：仅在 Docker 网络内暴露

## API 概览

### 用户反馈

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/feedback` | 提交反馈，`multipart/form-data` |
| `GET` | `/api/feedbacks` | 分页查询反馈列表 |
| `GET` | `/api/feedbacks/:id` | 查询单条反馈及分析结果 |
| `GET` | `/api/feedbacks/trace/:id` | 查询反馈和 AI 原始追踪详情 |

`GET /api/feedbacks` 支持筛选参数：

- `page`、`limit`
- `problem_type`
- `root_cause`
- `feature_module`
- `user_intent`
- `stage`
- `severity`
- `date_from`、`date_to`
- `has_analysis=true|false`
- `keyword`

### 统计与管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/stats/summary` | 统计摘要 |
| `GET` | `/api/admin/feedbacks/view` | HTML 管理列表页 |
| `GET` | `/api/admin/feedbacks/trace/:id` | HTML 管理追踪详情页 |
| `POST` | `/api/admin/send-report` | 手动触发飞书日报 |
| `GET` | `/health` | 健康检查 |

## 环境变量

| 变量 | 说明 | 默认/示例 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 后端监听端口 | `3000` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | 必填 |
| `MYSQL_DATABASE_RAW` | MySQL 初始化原始库名 | `raw_data` |
| `MYSQL_DATABASE_PROCESSED` | MySQL 初始化分析库名 | `processed_data` |
| `DB_HOST` | 后端连接 MySQL 主机 | `mysql` |
| `DB_PORT` | 后端连接 MySQL 端口 | `3306` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | 必填 |
| `DB_NAME_RAW` | 后端读取的原始库名 | `raw_data` |
| `DB_NAME_PROCESSED` | 后端读取的分析库名 | `processed_data` |
| `DASHSCOPE_API_KEY` | DashScope API Key | 必填 |
| `DASHSCOPE_API_URL` | DashScope OpenAI-compatible 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_MODEL` | 分析模型 | `qwen2.5-vl-72b-instruct` |
| `FEISHU_WEBHOOK_URL` | 飞书机器人 Webhook | 可选 |
| `REPORT_PUBLIC_BASE_URL` | 日报中管理页公网访问地址 | 可选 |
| `UPLOAD_DIR` | 后端上传目录 | `/app/uploads` |
| `MAX_FILE_SIZE` | 单文件大小限制，字节 | `5242880` |
| `MAX_FILES` | 单次上传文件数 | `3` |

## 验证结果

本次检查已执行：

- `node --check` 检查后端 `src/**/*.js`，通过。
- `npm run build` 构建前端，通 过。

未在本机启动完整 Docker 服务，因为这会依赖本机 Docker、MySQL 初始化状态和真实第三方密钥。

## 安全提示

- 不要提交 `.env`、真实 API Key、数据库密码或飞书 Webhook。
- `.env.example` 和 `.env.production` 只能保留占位值。
- 管理页面和手动推送接口当前没有鉴权，对公网开放前建议增加登录、IP 白名单或反向代理鉴权。
- 上传目录应使用持久化卷，并定期清理无效文件。

## 相关文档

- [部署说明](./DEPLOYMENT.md)
- [调试手册](./DEBUGGING_PLAYBOOK.md)
- [产品需求文档](./PRD.md)
