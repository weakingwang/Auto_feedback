# Auto Feedback | Z Code 反馈收集与 AI 分析系统

[![Node.js 20+](https://img.shields.io/badge/node.js-20+-green.svg)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/vue-3-42b883.svg)](https://vuejs.org/)
[![MySQL 8.0](https://img.shields.io/badge/mysql-8.0-blue.svg)](https://www.mysql.com/)
[![Docker Compose](https://img.shields.io/badge/docker-compose-2496ed.svg)](https://docs.docker.com/compose/)

> 一款面向 Z Code 产品体验优化的 **匿名反馈收集与 AI 结构化分析系统**，支持问题反馈提交、截图上传、AI 自动归因、反馈看板、管理追踪页与飞书日报推送。
>
> 用户反馈会写入 MySQL 原始数据表，并异步调用 **DashScope Qwen VL** 生成可检索、可统计、可追踪的结构化分析结果。

适用于产品团队、研发团队和运营团队集中收集用户问题，快速识别高频故障、体验阻塞、AI 质量问题和功能缺口。项目支持本地开发运行，也支持通过 Docker Compose 一键部署到服务器。

---

## 亮点速览

- **匿名提交**：用户无需登录即可提交问题类型、问题描述、上下文、环境信息、联系方式和截图。
- **截图辅助分析**：支持 JPG/JPEG/PNG，默认最多 3 张，单张最大 5 MB。
- **AI 自动归因**：输出根因、功能模块、用户意图、流程阶段、严重程度、置信度和判断依据。
- **反馈看板**：前端实时展示统计摘要、反馈列表和截图预览。
- **管理追踪**：内置 HTML 管理页面，支持关键词、日期、问题类型和 AI 分类字段筛选。
- **飞书日报**：每天 09:00 按 Asia/Shanghai 时区推送前一日反馈概览，也可手动触发。
- **容器化部署**：内置 MySQL、Express 后端和 Nginx 前端服务，适合服务器快速落地。

---

## 目录

- [亮点速览](#亮点速览)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [快速开始](#快速开始)
- [Docker 部署](#docker-部署)
- [API 概览](#api-概览)
- [环境变量](#环境变量)
- [安全提示](#安全提示)
- [相关文档](#相关文档)

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、Axios |
| 后端 | Node.js 20、Express、multer、mysql2、node-cron |
| 数据库 | MySQL 8.0 |
| AI 分析 | DashScope OpenAI-compatible API，默认模型 `qwen2.5-vl-72b-instruct` |
| 部署 | Docker Compose、Nginx |

## 目录结构

```text
auto_feedback/
+-- backend/                 # Express API 服务
|   +-- src/routes/          # 反馈、统计、管理页面路由
|   +-- src/services/        # AI 分析、飞书日报服务
|   +-- src/utils/           # MySQL 连接工具
+-- frontend/                # Vue 3 前端应用
|   +-- src/components/      # 表单、列表、上传、统计组件
|   +-- src/utils/api.js     # Axios API 封装
+-- infra/mysql/init.sql     # 数据库和表初始化脚本
+-- docs/                    # 参考资料、提示词和开发计划
+-- uploads/                 # 运行时上传目录挂载点
+-- docker-compose.yml       # Docker Compose 编排
+-- DEPLOYMENT.md            # 部署说明
+-- DEBUGGING_PLAYBOOK.md    # 排障手册
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

复制环境变量模板：

```bash
cp .env.example .env
```

至少需要修改：

```env
MYSQL_ROOT_PASSWORD=change_me_to_a_strong_password
DB_PASSWORD=change_me_to_a_strong_password
DASHSCOPE_API_KEY=your_dashscope_api_key
FEISHU_WEBHOOK_URL=your_feishu_bot_webhook_url
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
```

本地开发时，如果 MySQL 运行在宿主机：

```env
DB_HOST=localhost
UPLOAD_DIR=./uploads
```

Docker Compose 部署时：

```env
DB_HOST=mysql
UPLOAD_DIR=/app/uploads
NODE_ENV=production
```

### 3. 初始化数据库

Docker Compose 首次启动会自动执行 `infra/mysql/init.sql`。如果使用本地 MySQL，需要手动导入：

```bash
mysql -uroot -p < infra/mysql/init.sql
```

初始化脚本会创建：

- `raw_data.feedbacks`：保存用户原始反馈。
- `processed_data.ai_analysis`：保存 AI 结构化分析结果。

### 4. 启动开发服务

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

默认访问地址：

- 前端：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:3000/health`

## Docker 部署

完整部署流程见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

最小启动流程：

```bash
cp .env.example .env
# 编辑 .env 后再启动
docker compose build
docker compose up -d
docker compose ps
```

默认端口：

- 前端 Nginx：`80`
- 后端 API：`3000`
- MySQL：仅在 Docker 内部网络暴露

## API 概览

### 反馈接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/feedback` | 提交反馈，使用 `multipart/form-data`。 |
| `GET` | `/api/feedbacks` | 分页查询反馈列表，支持筛选。 |
| `GET` | `/api/feedbacks/:id` | 查询单条反馈及 AI 分析结果。 |
| `GET` | `/api/feedbacks/trace/:id` | 查询反馈和 AI 原始响应，用于追踪核对。 |

`POST /api/feedback` 字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `problem_type` | 是 | `cannot_use`、`cannot_understand`、`not_good_enough`。 |
| `issue_text` | 是 | 用户主要问题描述。 |
| `context_text` | 是 | 当时操作、目标或预期结果。 |
| `environment_info` | 是 | Z Code 版本、操作系统或相关环境信息。 |
| `contact` | 否 | 可选联系方式。 |
| `images` | 否 | 最多 3 张图片。 |

`GET /api/feedbacks` 支持的查询参数：

- `page`、`limit`
- `problem_type`
- `root_cause`
- `feature_module`
- `user_intent`
- `stage`
- `severity`
- `date_from`、`date_to`
- `feedback_id`
- `has_analysis=true|false`
- `keyword`

### 统计与管理接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/stats/summary` | 反馈总数、今日数量、问题类型分布和严重程度分布。 |
| `GET` | `/api/admin/feedbacks/view` | HTML 管理列表和筛选页面。 |
| `GET` | `/api/admin/feedbacks/trace/:id` | HTML 单条反馈追踪详情页。 |
| `POST` | `/api/admin/send-report` | 手动触发飞书日报。 |
| `GET` | `/health` | 后端健康检查。 |

## 环境变量

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 后端监听端口 | `3000` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | 必填 |
| `MYSQL_DATABASE_RAW` | MySQL 初始化原始反馈库名 | `raw_data` |
| `MYSQL_DATABASE_PROCESSED` | MySQL 初始化 AI 分析库名 | `processed_data` |
| `DB_HOST` | 后端连接 MySQL 主机 | `mysql` 或 `localhost` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_USER` | MySQL 用户 | `root` |
| `DB_PASSWORD` | 后端连接 MySQL 的密码 | 必填 |
| `DB_NAME_RAW` | 后端使用的原始反馈库名 | `raw_data` |
| `DB_NAME_PROCESSED` | 后端使用的 AI 分析库名 | `processed_data` |
| `DASHSCOPE_API_KEY` | DashScope API Key | AI 分析必填 |
| `DASHSCOPE_API_URL` | DashScope OpenAI-compatible 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_MODEL` | AI 分析模型 | `qwen2.5-vl-72b-instruct` |
| `FEISHU_WEBHOOK_URL` | 飞书自定义机器人 Webhook | 可选 |
| `REPORT_PUBLIC_BASE_URL` | 飞书日报中的公网访问地址 | `https://feedback.example.com` |
| `FEISHU_APP_ID` | 预留飞书应用 ID | 可选 |
| `FEISHU_APP_SECRET` | 预留飞书应用密钥 | 可选 |
| `UPLOAD_DIR` | 后端上传目录 | `/app/uploads` |
| `MAX_FILE_SIZE` | 单文件上传限制，单位字节 | `5242880` |
| `MAX_FILES` | 单次上传图片数量 | `3` |

## 安全提示

- 不要提交 `.env`、真实 API Key、数据库密码或飞书 Webhook。
- 当前管理页面和手动日报接口没有鉴权，公网开放前应增加登录、IP 白名单或反向代理鉴权。
- 生产环境建议只公开前端 `80/443`，不要直接公开后端 `3000`。
- 上传目录应使用持久化存储，并制定定期清理或归档策略。
- 如果密钥曾经泄露，应及时轮换 `DASHSCOPE_API_KEY`、`DB_PASSWORD` 和飞书 Webhook。

## 相关文档

- [部署说明](./DEPLOYMENT.md)
- [排障手册](./DEBUGGING_PLAYBOOK.md)
- [产品需求文档](./PRD.md)
