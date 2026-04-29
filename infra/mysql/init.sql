-- 创建原始数据数据库
CREATE DATABASE IF NOT EXISTS raw_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建AI分析结果数据库
CREATE DATABASE IF NOT EXISTS processed_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用原始数据库
USE raw_data;

-- 创建反馈表
CREATE TABLE IF NOT EXISTS feedbacks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_type VARCHAR(50) NOT NULL COMMENT '问题类型: cannot_use | cannot_understand | not_good_enough',
  issue_text TEXT NOT NULL COMMENT '问题描述',
  context_text TEXT COMMENT '补充上下文',
  environment_info VARCHAR(255) NOT NULL COMMENT 'Z Code 版本号与操作系统信息',
  contact VARCHAR(255) COMMENT '联系方式',
  images JSON COMMENT '图片URL数组',
  ip_address VARCHAR(45) COMMENT '提交者IP',
  user_agent TEXT COMMENT '浏览器信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_problem_type (problem_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户反馈原始数据表';

-- 使用AI分析数据库
USE processed_data;

-- 创建AI分析结果表
CREATE TABLE IF NOT EXISTS ai_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feedback_id INT NOT NULL COMMENT '关联原始反馈ID',
  root_cause VARCHAR(50) COMMENT '问题根因: bug_error | usability_issue | ai_quality_issue | performance_issue | product_gap | other | unknown',
  feature_module VARCHAR(50) COMMENT '功能模块: model_switch | code_generate | editor | run_preview | claude_init | project_setup | unknown',
  user_intent VARCHAR(50) COMMENT '用户意图: create_project | generate_code | modify_code | run_project | fix_error | learn_usage | unknown',
  stage VARCHAR(50) COMMENT '流程阶段: start_phase | input_phase | generation_phase | post_generation | run_phase | unknown',
  severity VARCHAR(20) COMMENT '严重程度: high | medium | low | unknown',
  confidence DECIMAL(3,2) COMMENT '置信度 0-1',
  reason TEXT COMMENT '判断依据',
  raw_response JSON COMMENT 'AI原始响应',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_id (feedback_id),
  INDEX idx_created_at (created_at),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI分析结果表';
