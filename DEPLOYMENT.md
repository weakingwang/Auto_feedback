# Deployment Guide

This guide explains how to deploy Auto Feedback on a server with Docker Compose.

## 1. Prerequisites

Install these on the target server:

- Docker Engine
- Docker Compose v2
- Network access to DashScope API
- Optional: a Feishu custom bot webhook for daily reports

Verify the installation:

```bash
docker --version
docker compose version
```

## 2. Prepare the Project

Enter the project directory:

```bash
cd auto_feedback
```

Create the runtime environment file:

```bash
cp .env.example .env
```

Edit `.env` and change at least:

```env
MYSQL_ROOT_PASSWORD=change_me_to_a_real_strong_password
DB_PASSWORD=change_me_to_a_real_strong_password
DASHSCOPE_API_KEY=your_dashscope_api_key
FEISHU_WEBHOOK_URL=your_feishu_bot_webhook_url
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
DAILY_REPORT_CRON=0 9 * * *
DAILY_REPORT_TIMEZONE=Asia/Shanghai
```

Recommended production values:

```env
NODE_ENV=production
DB_HOST=mysql
UPLOAD_DIR=/app/uploads
```

If you change database names, keep the MySQL initialization names and backend connection names aligned:

```env
MYSQL_DATABASE_RAW=raw_data
MYSQL_DATABASE_PROCESSED=processed_data
DB_NAME_RAW=raw_data
DB_NAME_PROCESSED=processed_data
```

`MYSQL_*` variables are used when the MySQL container initializes. `DB_NAME_*` variables are used by the backend at runtime.

## 3. Start the Stack

Build and start all services:

```bash
docker compose build
docker compose up -d
docker compose ps
```

Services:

| Service | Container | Purpose |
| --- | --- | --- |
| `mysql` | `feedback_mysql` | MySQL 8.0 database. |
| `backend` | `feedback_backend` | Express API, upload handling, AI analysis, Feishu report job. |
| `frontend` | `feedback_frontend` | Nginx static frontend and reverse proxy. |

On first startup, MySQL executes `infra/mysql/init.sql` and creates:

- `raw_data.feedbacks`
- `processed_data.ai_analysis`

## 4. Verify the Deployment

Check service status:

```bash
docker compose ps
```

Check backend health:

```bash
curl http://127.0.0.1:3000/health
```

Open the frontend:

```text
http://your-domain-or-server-ip/
```

Open the admin feedback page:

```text
http://your-domain-or-server-ip/api/admin/feedbacks/view
```

Manually trigger a Feishu report:

```bash
curl -X POST http://127.0.0.1:3000/api/admin/send-report
```

## 5. Logs

View logs for each service:

```bash
docker compose logs -f --tail=200 mysql
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 frontend
```

For AI analysis and Feishu report issues, start with backend logs:

```bash
docker compose logs -f --tail=200 backend
```

## 6. Common Operations

Restart services:

```bash
docker compose restart backend frontend
```

Rebuild after code changes:

```bash
docker compose build backend frontend
docker compose up -d backend frontend
```

Stop services without deleting persistent data:

```bash
docker compose down
```

Do not run `docker compose down -v` unless you intentionally want to delete the MySQL volume and lose database data.

## 7. Persistent Data

MySQL data is stored in the Docker volume:

```text
mysql_data
```

Uploaded screenshots are stored on the host:

```text
./uploads
```

The backend sees the upload directory as:

```text
/app/uploads
```

Back up both the MySQL volume and `./uploads` according to your retention requirements.

## 8. Network and Reverse Proxy

The frontend container exposes port `80`. Its Nginx config serves the built Vue app and proxies:

- `/api/` to `backend:3000`
- `/uploads/` to `backend:3000`

If you place another reverse proxy such as Nginx, Caddy, or a cloud load balancer in front of this stack, expose only ports `80` and `443` publicly. Keep backend port `3000` private unless you have a specific internal need.

Recommended external proxy behavior:

```text
/          -> feedback_frontend:80
/api/      -> feedback_frontend:80
/uploads/  -> feedback_frontend:80
```

The frontend container will forward API and upload requests to the backend inside the Compose network.

## 9. HTTPS

Terminate HTTPS at your external reverse proxy or cloud gateway. Make sure `REPORT_PUBLIC_BASE_URL` uses the public HTTPS origin so Feishu report links open correctly:

```env
REPORT_PUBLIC_BASE_URL=https://feedback.example.com
```

## 10. Security Hardening

- Add authentication or IP allowlisting before exposing `/api/admin/*` or `/api/admin/send-report` publicly.
- Use strong values for `MYSQL_ROOT_PASSWORD` and `DB_PASSWORD`.
- Keep `.env` outside version control.
- Restrict direct public access to backend port `3000`.
- Rotate DashScope keys and Feishu webhook URLs periodically.
- Monitor upload volume growth and apply a cleanup or archival policy.

## 11. Troubleshooting

### Backend Fails to Connect to MySQL

Check service health and logs:

```bash
docker compose ps
docker compose logs --tail=200 mysql
docker compose logs --tail=200 backend
```

Confirm `.env` contains:

```env
DB_HOST=mysql
DB_PASSWORD=<same value as MYSQL_ROOT_PASSWORD when using root>
DB_NAME_RAW=raw_data
DB_NAME_PROCESSED=processed_data
```

If MySQL was initialized with different database names, update both `MYSQL_DATABASE_*` and `DB_NAME_*` consistently.

### Uploaded Images Cannot Be Opened

Confirm upload configuration:

```env
UPLOAD_DIR=/app/uploads
```

Confirm `docker-compose.yml` mounts the host directory:

```yaml
volumes:
  - ./uploads:/app/uploads
```

Then check backend logs:

```bash
docker compose logs --tail=200 backend
```

### AI Analysis Does Not Appear

Feedback is saved first, and AI analysis runs asynchronously after submission. Check backend logs:

```bash
docker compose logs -f --tail=200 backend
```

Confirm DashScope configuration:

```env
DASHSCOPE_API_KEY=your_valid_key
DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen2.5-vl-72b-instruct
```

Also confirm the server can reach DashScope from inside the backend container.

### Feishu Report Is Not Sent

Trigger the report manually and inspect backend logs:

```bash
curl -X POST http://127.0.0.1:3000/api/admin/send-report
docker compose logs --tail=200 backend
```

Confirm:

```env
FEISHU_WEBHOOK_URL=your_valid_feishu_bot_webhook
REPORT_PUBLIC_BASE_URL=https://feedback.example.com
DAILY_REPORT_CRON=0 9 * * *
DAILY_REPORT_TIMEZONE=Asia/Shanghai
```

The automatic report schedule is controlled by `DAILY_REPORT_CRON` and `DAILY_REPORT_TIMEZONE`. The default value runs every day at `09:00` in the `Asia/Shanghai` timezone.

### Frontend Opens but API Calls Fail

Check the frontend container and Nginx proxy logs:

```bash
docker compose logs --tail=200 frontend
docker compose logs --tail=200 backend
```

Confirm the backend is healthy:

```bash
curl http://127.0.0.1:3000/health
```

If an external reverse proxy is used, make sure it forwards `/api/` and `/uploads/` to the frontend container, not directly to static files.
