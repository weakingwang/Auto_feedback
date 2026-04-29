# Deployment Guide

本文档说明如何在服务器上使用 Docker Compose 部署 Auto Feedback。

## 1. 前置条件

服务器需要安装：

- Docker Engine
- Docker Compose v2
- 可访问 DashScope API 的网络
- 可选：已配置飞书自定义机器人

确认命令：

```bash
docker --version
docker compose version
```

## 2. 准备项目

进入项目根目录：

```bash
cd auto_feedback
```

创建环境变量文件：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

```env
MYSQL_ROOT_PASSWORD=change_me_to_a_real_strong_password
DB_PASSWORD=change_me_to_a_real_strong_password
DASHSCOPE_API_KEY=your_dashscope_api_key
FEISHU_WEBHOOK_URL=your_feishu_bot_webhook_url
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
```

生产部署推荐保留：

```env
DB_HOST=mysql
UPLOAD_DIR=/app/uploads
NODE_ENV=production
```

如果修改数据库名，需要同时修改：

```env
MYSQL_DATABASE_RAW=raw_data
MYSQL_DATABASE_PROCESSED=processed_data
DB_NAME_RAW=raw_data
DB_NAME_PROCESSED=processed_data
```

`MYSQL_*` 用于 MySQL 容器初始化，`DB_NAME_*` 用于后端连接数据库，两组值必须保持一致。

## 3. 构建并启动

```bash
docker compose build
docker compose up -d
docker compose ps
```

首次启动时，MySQL 会执行 `mysql/init.sql` 创建：

- `raw_data.feedbacks`
- `processed_data.ai_analysis`

查看日志：

```bash
docker compose logs -f --tail=200 mysql
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 frontend
```

## 4. 验证部署

健康检查：

```bash
curl http://127.0.0.1:3000/health
```

浏览器访问：

```text
http://your-domain-or-server-ip/
```

管理页面：

```text
http://your-domain-or-server-ip/api/admin/feedbacks/view
```

手动触发飞书日报：

```bash
curl -X POST http://127.0.0.1:3000/api/admin/send-report
```

## 5. 常用运维命令

查看服务状态：

```bash
docker compose ps
```

重启服务：

```bash
docker compose restart backend frontend
```

更新代码后重新构建：

```bash
docker compose build backend frontend
docker compose up -d backend frontend
```

停止服务：

```bash
docker compose down
```

注意：`docker compose down -v` 会删除数据库卷，除非确认要清空数据，否则不要使用。

## 6. 数据和文件持久化

MySQL 数据保存在 Docker volume：

```text
mysql_data
```

上传图片保存在宿主机目录：

```text
./uploads
```

后端容器内路径：

```text
/app/uploads
```

建议定期备份数据库和上传目录。

## 7. 反向代理和 HTTPS

如果服务器已有 Nginx、Caddy 或云厂商网关，建议只对公网暴露前端 80/443，并把请求转发到 Compose 中的前端服务。

需要代理的路径：

- `/`：前端静态页面
- `/api/`：后端 API
- `/uploads/`：上传图片访问

当前 `frontend/nginx.conf` 已在容器内把 `/api/` 和 `/uploads/` 代理到 `backend:3000`。

## 8. 安全加固建议

- 对 `/api/admin/*` 和 `/api/admin/send-report` 增加鉴权后再开放公网。
- 使用强密码并定期轮换 `MYSQL_ROOT_PASSWORD`、`DB_PASSWORD`、`DASHSCOPE_API_KEY` 和飞书 Webhook。
- 不要把 `.env`、真实密钥或生产 Webhook 提交到代码仓库。
- 通过防火墙限制后端 `3000` 端口公网访问，仅让前端反向代理访问。
- 根据业务要求配置上传文件清理策略。

## 9. 故障排查

### 后端启动失败并提示数据库连接失败

检查：

```bash
docker compose ps
docker compose logs --tail=200 mysql
docker compose logs --tail=200 backend
```

确认 `.env` 中：

```env
DB_HOST=mysql
DB_PASSWORD=与 MYSQL_ROOT_PASSWORD 一致
DB_NAME_RAW=raw_data
DB_NAME_PROCESSED=processed_data
```

### 上传图片无法访问

检查：

```bash
docker compose logs --tail=200 backend
```

确认：

```env
UPLOAD_DIR=/app/uploads
```

并确认 `docker-compose.yml` 中存在挂载：

```yaml
volumes:
  - ./uploads:/app/uploads
```

### AI 分析没有结果

反馈提交成功后，AI 分析是异步执行的。检查后端日志：

```bash
docker compose logs -f --tail=200 backend
```

确认：

```env
DASHSCOPE_API_KEY=有效密钥
DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen2.5-vl-72b-instruct
```

### 飞书日报未推送

检查：

```bash
curl -X POST http://127.0.0.1:3000/api/admin/send-report
docker compose logs --tail=200 backend
```

确认：

```env
FEISHU_WEBHOOK_URL=有效飞书机器人 Webhook
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
```
