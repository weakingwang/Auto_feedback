# 信息收集与AI处理系统 - 开发计划

## 1. 项目概述
最小MVP项目，实现前端信息收集、后端AI处理、数据存储、飞书通知的完整流程。

## 2. 技术栈
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue.js | 信息收集表单 |
| 后端 | Node.js | AI模型调用与业务逻辑 |
| AI模型 | Qwen3-VL | 图文处理能力 |
| 数据库 | MySQL | 数据库A存原始数据，数据库B存处理后数据 |
| 部署 | Docker + Nginx | 本地开发，Docker部署到服务器 |
| 通知 | 飞书Webhook | 定时任务推送处理结果 |

## 3. 系统架构
```
前端(Vue.js) → 后端(Node.js) → AI处理(Qwen3-VL) → 数据库A/B(MySQL) → 定时任务 → 飞书Webhook
```

## 4. 核心功能模块

### 4.1 前端模块
- 信息收集表单页面
- 支持图文上传
- 表单提交接口调用

### 4.2 后端模块
- API接口：接收前端数据
- AI处理：调用Qwen3-VL，使用给定提示词处理信息
- 数据存储：原始数据→数据库A，处理后数据→数据库B
- 飞书推送：定时任务读取数据库B，发送Webhook通知

### 4.3 部署配置
- Dockerfile（前端 + 后端）
- Docker Compose编排
- Nginx反向代理配置

## 5. 飞书Webhook配置
```
https://open.feishu.cn/open-apis/bot/v2/hook/e00bf023-e17d-48ba-ac11-ff53cc64b897
```

## 6. 开发阶段流程

### 阶段1：基础搭建
1. 初始化Vue.js前端项目，搭建信息收集表单页面
2. 初始化Node.js后端项目，搭建基础API框架
3. 实现前后端联调，完成数据提交接口

### 阶段2：AI处理接入
1. 接入Qwen3-VL模型
2. 配置模型判断提示词
3. 实现图文数据处理逻辑
4. 验证AI处理结果准确性

### 阶段3：数据存储
1. 配置MySQL数据库A（原始数据）
2. 配置MySQL数据库B（处理后数据）
3. 实现数据写入逻辑
4. 完成数据流转测试

### 阶段4：定时推送
1. 实现定时任务读取数据库B
2. 接入飞书Webhook推送
3. 配置推送消息格式
4. 验证推送功能正常

### 阶段5：部署上线
1. 编写前端Dockerfile
2. 编写后端Dockerfile
3. 配置Docker Compose
4. 配置Nginx反向代理
5. 服务器部署验证

## 7. 目录结构
```
project/
├── frontend/          # Vue.js前端
├── backend/           # Node.js后端
├── docker-compose.yml
└── nginx.conf
```
