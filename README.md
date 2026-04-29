# Auto Feedback

Auto Feedback is a lightweight feedback collection and AI triage system for Z Code. Users can submit structured feedback with screenshots, while the backend stores raw feedback in MySQL and asynchronously calls DashScope Qwen VL to produce machine-readable analysis for search, statistics, and daily reports.

## Features

- Anonymous feedback form with issue type, issue description, context, environment information, contact, and screenshots.
- Screenshot upload for JPG/JPEG/PNG images, up to 3 files per submission and 5 MB per file by default.
- Asynchronous AI analysis through DashScope's OpenAI-compatible Chat Completions API.
- Structured analysis fields for root cause, feature module, user intent, workflow stage, severity, confidence, and reasoning.
- Feedback dashboard in the Vue app with summary cards, recent feedback, and screenshot preview.
- HTML admin tracing pages for filtering feedback and reviewing raw user input against AI output.
- Feishu daily report scheduled at 09:00 Asia/Shanghai, with a manual trigger endpoint for testing.
- Docker Compose deployment with MySQL, Node.js backend, and Nginx-served frontend.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, Vite, Axios |
| Backend | Node.js 20, Express, multer, mysql2, node-cron |
| Database | MySQL 8.0 |
| AI | DashScope OpenAI-compatible API, default model `qwen2.5-vl-72b-instruct` |
| Deployment | Docker Compose, Nginx |

## Project Structure

```text
auto_feedback/
+-- backend/                 # Express API service
|   +-- src/routes/          # Feedback, stats, and admin HTML routes
|   +-- src/services/        # AI analysis and Feishu report services
|   +-- src/utils/           # MySQL connection helpers
+-- frontend/                # Vue 3 application
|   +-- src/components/      # Feedback form, list, uploader, summary cards
|   +-- src/utils/api.js     # Axios API client
+-- mysql/init.sql           # MySQL database and table initialization
+-- uploads/                 # Runtime upload mount point
+-- docker-compose.yml       # Production-like Compose stack
+-- DEPLOYMENT.md            # Server deployment guide
+-- DEBUGGING_PLAYBOOK.md    # Troubleshooting notes
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create a runtime environment file from the example:

```bash
cp .env.example .env
```

At minimum, update these values:

```env
MYSQL_ROOT_PASSWORD=change_me_to_a_strong_password
DB_PASSWORD=change_me_to_a_strong_password
DASHSCOPE_API_KEY=your_dashscope_api_key
FEISHU_WEBHOOK_URL=your_feishu_bot_webhook_url
REPORT_PUBLIC_BASE_URL=http://your-domain-or-server-ip
```

For local development with MySQL running on the host:

```env
DB_HOST=localhost
UPLOAD_DIR=./uploads
```

For Docker Compose:

```env
DB_HOST=mysql
UPLOAD_DIR=/app/uploads
NODE_ENV=production
```

### 3. Initialize MySQL

The Docker deployment runs `mysql/init.sql` automatically on first startup. For a local MySQL instance, import it manually:

```bash
mysql -uroot -p < mysql/init.sql
```

The script creates:

- `raw_data.feedbacks`
- `processed_data.ai_analysis`

### 4. Start Development Servers

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend health check: `http://127.0.0.1:3000/health`

## Docker Deployment

For the full production-style deployment guide, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Minimal startup flow:

```bash
cp .env.example .env
# Edit .env before starting.
docker compose build
docker compose up -d
docker compose ps
```

Default exposed ports:

- Frontend Nginx: `80`
- Backend API: `3000`
- MySQL: internal Docker network only

## API Overview

### Feedback

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/feedback` | Submit feedback as `multipart/form-data`. |
| `GET` | `/api/feedbacks` | List feedback records with optional filters. |
| `GET` | `/api/feedbacks/:id` | Fetch one feedback record with analysis. |
| `GET` | `/api/feedbacks/trace/:id` | Fetch raw feedback and AI raw response for trace review. |

`POST /api/feedback` expects:

| Field | Required | Description |
| --- | --- | --- |
| `problem_type` | Yes | `cannot_use`, `cannot_understand`, or `not_good_enough`. |
| `issue_text` | Yes | Main user issue description. |
| `context_text` | Yes | Context, intended action, or expected result. |
| `environment_info` | Yes | Z Code version, OS, or relevant runtime information. |
| `contact` | No | Optional follow-up contact. |
| `images` | No | Up to 3 image files. |

`GET /api/feedbacks` supports:

- `page`, `limit`
- `problem_type`
- `root_cause`
- `feature_module`
- `user_intent`
- `stage`
- `severity`
- `date_from`, `date_to`
- `feedback_id`
- `has_analysis=true|false`
- `keyword`

### Stats and Admin

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/stats/summary` | Summary counts and distributions for the frontend. |
| `GET` | `/api/admin/feedbacks/view` | HTML admin list and filter page. |
| `GET` | `/api/admin/feedbacks/trace/:id` | HTML trace detail page for a single feedback item. |
| `POST` | `/api/admin/send-report` | Manually trigger the Feishu daily report. |
| `GET` | `/health` | Backend health check. |

## Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment. | `production` |
| `PORT` | Backend port. | `3000` |
| `MYSQL_ROOT_PASSWORD` | MySQL root password used by the MySQL container. | Required |
| `MYSQL_DATABASE_RAW` | Raw feedback database initialized by MySQL. | `raw_data` |
| `MYSQL_DATABASE_PROCESSED` | AI analysis database initialized by `init.sql`. | `processed_data` |
| `DB_HOST` | MySQL host used by the backend. | `mysql` or `localhost` |
| `DB_PORT` | MySQL port. | `3306` |
| `DB_USER` | MySQL user. | `root` |
| `DB_PASSWORD` | MySQL password used by the backend. | Required |
| `DB_NAME_RAW` | Raw feedback database used by the backend. | `raw_data` |
| `DB_NAME_PROCESSED` | AI analysis database used by the backend. | `processed_data` |
| `DASHSCOPE_API_KEY` | DashScope API key. | Required for AI analysis |
| `DASHSCOPE_API_URL` | DashScope OpenAI-compatible base URL. | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_MODEL` | Model used for feedback analysis. | `qwen2.5-vl-72b-instruct` |
| `FEISHU_WEBHOOK_URL` | Feishu custom bot webhook. | Optional |
| `REPORT_PUBLIC_BASE_URL` | Public base URL used in Feishu report links. | `https://feedback.example.com` |
| `FEISHU_APP_ID` | Reserved Feishu app ID. | Optional |
| `FEISHU_APP_SECRET` | Reserved Feishu app secret. | Optional |
| `UPLOAD_DIR` | Backend upload directory. | `/app/uploads` |
| `MAX_FILE_SIZE` | Per-file upload limit in bytes. | `5242880` |
| `MAX_FILES` | Intended max image count per submission. | `3` |

## Security Notes

- Do not commit `.env`, production credentials, real API keys, database passwords, or Feishu webhooks.
- The current admin pages and manual report endpoint do not implement authentication. Add access control before exposing them on the public internet.
- Keep backend port `3000` private behind Nginx or a firewall in production.
- Store uploads on persistent storage and define an operational cleanup policy.
- Rotate `DASHSCOPE_API_KEY`, `DB_PASSWORD`, and Feishu webhook credentials if they were ever shared.

## Related Docs

- [Deployment Guide](./DEPLOYMENT.md)
- [Debugging Playbook](./DEBUGGING_PLAYBOOK.md)
- [Product Requirements](./PRD.md)
