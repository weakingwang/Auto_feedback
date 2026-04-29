# 用户反馈收集与AI分析系统 - 产品需求文档 (PRD)

## 1. 项目概述

### 1.1 产品定位
构建一个MVP级别的用户反馈收集系统，前端展示为公开留言墙形式，用户可匿名提交产品使用反馈。后端调用AI模型分析反馈内容，提取结构化信息，并通过飞书定时推送汇总报告。

### 1.2 目标用户
完全开放匿名使用，任何用户均可提交反馈，无需注册登录。

### 1.3 核心功能
- 前端表单收集用户反馈（图文）
- AI智能分析反馈内容（问题类型、根因、严重程度等）
- 数据分库存储（原始数据 vs 分析结果）
- 飞书定时推送每日汇总

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端 | Vue.js 3 | 保持 `docs/reference/main.css` 视觉风格 |
| 后端 | Node.js + Express | RESTful API |
| AI模型 | Qwen2.5-VL | 阿里云DashScope API |
| 数据库 | MySQL 8.0 | Docker部署，同一实例双库 |
| 部署 | Docker + Docker Compose | Linux服务器 |
| 通知 | 飞书Webhook | 定时推送 |

---

## 3. 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端 (Vue.js)  │────▶│  后端 (Node.js)  │────▶│ AI (Qwen2.5-VL) │
│  47.95.113.32:80 │     │   :3000 API     │     │  DashScope API  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      MySQL (Docker)     │
                    │  ┌─────────────────┐    │
                    │  │  DB_A: 原始数据  │    │
                    │  └─────────────────┘    │
                    │  ┌─────────────────┐    │
                    │  │  DB_B: AI结果    │    │
                    │  └─────────────────┘    │
                    └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    每日09:00定时任务     │
                    │     飞书Webhook推送      │
                    └─────────────────────────┘
```

---

## 4. 前端设计

### 4.1 页面布局
基于 `docs/reference/main.css` 的两栏响应式布局：

**左栏（40%）- 反馈提交表单**
- glass-card卡片样式
- 表单字段垂直排列
- 图片上传预览区域

**右栏（60%）- 公开留言墙**
- 滚动列表展示所有反馈
- feedback-card样式卡片
- 汇总统计卡片（summary-card）

### 4.2 表单字段

| 字段名 | 类型 | 必填 | UI样式 | 说明 |
|--------|------|------|--------|------|
| problem_type | select | 是 | glass-input--feedback | 问题类型下拉选择 |
| issue_text | textarea | 是 | composer-textarea | 问题描述 |
| context_text | textarea | 否 | composer-textarea--secondary | 补充信息 |
| images | file | 否 | upload-preview | 图片上传，0-3张 |
| contact | text | 否 | glass-input | 联系方式，选填 |

**problem_type选项：**
- `cannot_use` - 功能不可用 / 报错
- `cannot_understand` - 下一步不知道如何进行
- `not_good_enough` - 最终效果不太好

**图片上传约束：**
- 格式：jpg, png
- 单张最大：5MB
- 最多：3张
- 存储：本地文件系统

### 4.3 反馈列表展示

**展示内容（原始数据，不展示AI分析结果）：**
- 用户标识（匿名，显示随机头像/标识）
- 提交时间
- 问题类型标签（tag样式）
- 问题描述
- 图片预览（如有）
- 联系方式（如有，内部展示）

**UI组件：**
- feedback-card：玻璃态卡片，hover动画效果
- avatar-badge：用户头像标识
- tag：问题类型标签
- attachment-strip：图片附件预览

---

## 5. 后端API设计

### 5.1 数据库设计

**数据库A - raw_data（原始数据）**
```sql
CREATE DATABASE IF NOT EXISTS raw_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE feedbacks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_type VARCHAR(50) NOT NULL COMMENT '问题类型',
  issue_text TEXT NOT NULL COMMENT '问题描述',
  context_text TEXT COMMENT '补充上下文',
  contact VARCHAR(255) COMMENT '联系方式',
  images JSON COMMENT '图片URL数组',
  ip_address VARCHAR(45) COMMENT '提交者IP',
  user_agent TEXT COMMENT '浏览器信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_problem_type (problem_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**数据库B - processed_data（AI分析结果）**
```sql
CREATE DATABASE IF NOT EXISTS processed_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE ai_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feedback_id INT NOT NULL COMMENT '关联原始反馈ID',
  root_cause VARCHAR(50) COMMENT '问题根因',
  feature_module VARCHAR(50) COMMENT '功能模块',
  user_intent VARCHAR(50) COMMENT '用户意图',
  stage VARCHAR(50) COMMENT '流程阶段',
  severity VARCHAR(20) COMMENT '严重程度',
  confidence DECIMAL(3,2) COMMENT '置信度0-1',
  reason TEXT COMMENT '判断依据',
  raw_response JSON COMMENT 'AI原始响应',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_id (feedback_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.2 API端点

#### POST /api/feedback
提交反馈

**请求：**
```http
Content-Type: multipart/form-data

{
  "problem_type": "cannot_use",
  "issue_text": "切换模型后一直报错",
  "context_text": "我刚刚在切换模型，然后想生成一个网页",
  "contact": "user@example.com",
  "images": [File, File, File]  // 可选，最多3个文件
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "message": "反馈提交成功"
  }
}
```

**处理流程：**
1. 接收并验证表单数据
2. 保存图片到本地，生成URL
3. 原始数据写入DB_A
4. 异步调用AI分析
5. AI结果写入DB_B
6. 返回成功响应

#### GET /api/feedbacks
获取反馈列表（分页）

**查询参数：**
- `page` - 页码，默认1
- `limit` - 每页数量，默认20
- `problem_type` - 按类型筛选（可选）

**响应：**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 123,
        "problem_type": "cannot_use",
        "problem_type_label": "功能不可用",
        "issue_text": "...",
        "context_text": "...",
        "images": ["/uploads/xxx.jpg"],
        "created_at": "2025-04-12T10:30:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /api/feedbacks/:id
获取单条反馈详情

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "problem_type": "cannot_use",
    "issue_text": "...",
    "context_text": "...",
    "images": [...],
    "created_at": "...",
    "analysis": {  // 内部使用，前端不展示
      "root_cause": "bug_error",
      "severity": "high",
      "confidence": 0.93
    }
  }
}
```

#### GET /api/stats/summary
获取统计摘要（用于前端汇总卡片）

**响应：**
```json
{
  "success": true,
  "data": {
    "total_count": 156,
    "today_count": 12,
    "problem_type_distribution": {
      "cannot_use": 45,
      "cannot_understand": 67,
      "not_good_enough": 44
    },
    "severity_distribution": {
      "high": 23,
      "medium": 89,
      "low": 44
    }
  }
}
```

---

## 6. AI处理逻辑

### 6.1 模型配置

**模型：** Qwen2.5-VL
**API端点：** `https://dashscope.aliyuncs.com/compatible-mode/v1`
**认证：** API Key
**调用方式：** OpenAI兼容格式 (Chat Completions)

### 6.2 输入格式化

```json
{
  "problem_type": "cannot_use | cannot_understand | not_good_enough",
  "issue_text": "用户填写的问题描述",
  "context_text": "用户填写的补充上下文"
}
```

### 6.3 提示词

使用 `docs/reference/ai_prompt.md` 中的完整提示词，核心约束：
- 只输出JSON对象，不要Markdown代码块
- 不要输出任何解释性文字
- 所有字段必须返回，无法判断填`unknown`
- `confidence`必须是0-1之间的数字
- `reason`必须是简短中文

### 6.4 输出结构

```json
{
  "root_cause": "bug_error | usability_issue | ai_quality_issue | performance_issue | product_gap | other | unknown",
  "feature_module": "model_switch | code_generate | editor | run_preview | claude_init | project_setup | unknown",
  "user_intent": "create_project | generate_code | modify_code | run_project | fix_error | learn_usage | unknown",
  "stage": "start_phase | input_phase | generation_phase | post_generation | run_phase | unknown",
  "severity": "high | medium | low | unknown",
  "confidence": 0.93,
  "reason": "用户明确提到切换模型时报错，且阻塞生成网页"
}
```

### 6.5 图片处理

- 用户上传的图片转换为base64或上传后通过URL引用
- 作为multimodal输入传递给Qwen2.5-VL
- 截图属于辅助证据，如与文字冲突以文字描述为准

---

## 7. 定时任务与飞书推送

### 7.1 触发时间
每日早上9:00 (cron: `0 9 * * *`)

### 7.2 推送内容

**前一天数据汇总（Markdown格式）：**

```markdown
📊 用户反馈日报 - 2025年4月11日

📈 数据概览
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 总反馈数：32条
• 高优先级：5条
• 中优先级：18条
• 低优先级：9条

📋 问题类型分布
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| 类型 | 数量 | 占比 |
|------|------|------|
| 功能不可用 | 12 | 37.5% |
| 操作不理解 | 15 | 46.9% |
| 效果不够好 | 5 | 15.6% |

🔥 根因分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| 根因 | 数量 |
|------|------|
| 功能异常(bug_error) | 8 |
| 使用体验(usability_issue) | 14 |
| AI质量问题(ai_quality_issue) | 6 |
| 性能问题(performance_issue) | 2 |
| 功能缺失(product_gap) | 2 |

⚠️ 高优先级问题（需关注）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [高] 切换模型后报错 - 置信度0.93
   根因：功能异常 | 模块：model_switch
   
2. [高] 生成后页面白屏 - 置信度0.88
   根因：功能异常 | 模块：run_preview
```

### 7.3 Webhook配置

**请求格式：**
```json
{
  "msg_type": "text",
  "content": {
    "text": "Markdown内容"
  }
}
```


## 8. 部署配置

### 8.1 服务器信息

- **操作系统：** Linux
- **公网IP：** 47.95.113.32
- **对外端口：** 80
- **Docker版本：** 26.1.3

### 8.2 目录结构

```
auto_feedback/
├── docker-compose.yml          # 服务编排
├── .env                        # 环境变量
├── frontend/                   # Vue前端
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── main.js
│       ├── App.vue
│       └── components/
├── backend/                    # Node后端
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── routes/
│       │   └── feedback.js
│       ├── services/
│       │   ├── aiService.js
│       │   ├── feishuService.js
│       │   └── statsService.js
│       └── utils/
│           └── database.js
└── uploads/                    # 图片存储（Docker volume挂载）
```

### 8.3 Docker Compose 服务

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: feedback_mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./infra/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - feedback_network

  backend:
    build: ./backend
    container_name: feedback_backend
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    env_file:
      - ./backend/.env
    depends_on:
      - mysql
    networks:
      - feedback_network

  frontend:
    build: ./frontend
    container_name: feedback_frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - feedback_network

volumes:
  mysql_data:

networks:
  feedback_network:
```

### 8.4 环境变量配置

**根目录 .env：**
```
# MySQL
MYSQL_ROOT_PASSWORD=your_secure_password_here
MYSQL_DATABASE_RAW=raw_data
MYSQL_DATABASE_PROCESSED=processed_data
```

**backend/.env：**
```
# Server
NODE_ENV=production
PORT=3000

# MySQL
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_secure_password_here
DB_NAME_RAW=raw_data
DB_NAME_PROCESSED=processed_data

# AI API (DashScope)
DASHSCOPE_API_KEY=sk-553244831982439da2ff9e938fb4b4ad
DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen2.5-vl-72b-instruct

# Feishu
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/e00bf023-e17d-48ba-ac11-ff53cc64b897

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880  # 5MB
MAX_FILES=3
```

### 8.5 Nginx配置

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /app/uploads/;
    }
}
```

---

## 9. 开发计划

### Phase 1: 基础框架（Day 1）
- [ ] 初始化 Vue 前端项目，集成 `docs/reference/main.css`
- [ ] 初始化Node后端项目，配置Express
- [ ] 配置Docker Compose（MySQL）
- [ ] 编写数据库初始化脚本

### Phase 2: 前端功能（Day 2）
- [ ] 表单页面（problem_type选择器、文本框、图片上传）
- [ ] 反馈列表展示组件
- [ ] 汇总统计卡片
- [ ] 响应式布局适配

### Phase 3: 后端功能（Day 3）
- [ ] 图片上传API，本地存储
- [ ] 反馈提交API，数据入库
- [ ] 反馈列表查询API
- [ ] 统计摘要API

### Phase 4: AI集成（Day 4）
- [ ] DashScope API接入
- [ ] AI分析服务实现
- [ ] 异步处理队列（防止阻塞）
- [ ] AI结果入库

### Phase 5: 定时任务（Day 5）
- [ ] node-cron定时任务配置
- [ ] 飞书Webhook推送服务
- [ ] Markdown报表生成
- [ ] 测试定时触发

### Phase 6: 部署上线（Day 6）
- [ ] 编写Dockerfile（前端+后端）
- [ ] Nginx反向代理配置
- [ ] 服务器部署验证
- [ ] 端到端功能测试

---

## 10. 验收标准

### 功能验收
- [ ] 用户可通过 http://47.95.113.32 访问系统
- [ ] 表单可正常提交反馈（含图文）
- [ ] 反馈列表实时展示所有提交
- [ ] 图片上传正常，可预览
- [ ] 联系方式字段选填有效

### 数据处理
- [ ] 提交数据正确存入DB_A
- [ ] AI自动分析并结果存入DB_B
- [ ] 图片文件正确保存到本地

### 定时任务
- [ ] 每日09:00自动触发
- [ ] 飞书消息格式正确（Markdown表格）
- [ ] 汇总数据准确（前一日统计）

### 性能要求
- [ ] 页面加载 < 3秒
- [ ] 表单提交 < 5秒（含AI分析）
- [ ] 列表查询 < 1秒（20条/页）

---

## 11. 风险与注意事项

1. **API Key安全：** API密钥存储在.env文件，不上传Git
2. **图片存储：** uploads目录需要持久化volume，防止容器重启数据丢失
3. **AI调用限制：** 关注DashScope API调用频率限制和计费
4. **数据备份：** 生产环境建议定期备份MySQL数据
5. **定时任务可靠性：** 使用容器内持久化进程，避免使用宿主机crontab

---

## 附录

### A. AI提示词完整版
参见 `docs/reference/ai_prompt.md` 文件

### B. 前端样式参考
参见 `docs/reference/main.css` 文件

### C. API文档
- DashScope API: your API
- Feishu Webhook: your webhook

---

**文档版本：** v1.0  
**创建日期：** 2025-04-12  
**最后更新：** 2025-04-29
