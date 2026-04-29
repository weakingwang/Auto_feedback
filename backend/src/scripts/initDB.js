import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const initDB = async () => {
  try {
    // 连接MySQL（不指定数据库）
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    })

    console.log('Connected to MySQL')

    // 创建数据库
    await connection.execute('CREATE DATABASE IF NOT EXISTS raw_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    await connection.execute('CREATE DATABASE IF NOT EXISTS processed_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    console.log('Databases created')

    // 读取并执行SQL初始化脚本
    const sqlPath = path.join(__dirname, '..', '..', '..', 'mysql', 'init.sql')
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf8')

      // 使用raw_data数据库
      await connection.changeUser({ database: 'raw_data' })
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          problem_type VARCHAR(50) NOT NULL,
          issue_text TEXT NOT NULL,
          context_text TEXT,
          environment_info VARCHAR(255) NOT NULL,
          contact VARCHAR(255),
          images JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_created_at (created_at),
          INDEX idx_problem_type (problem_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      console.log('raw_data.feedbacks table created')

      // 使用processed_data数据库
      await connection.changeUser({ database: 'processed_data' })
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ai_analysis (
          id INT AUTO_INCREMENT PRIMARY KEY,
          feedback_id INT NOT NULL,
          root_cause VARCHAR(50),
          feature_module VARCHAR(50),
          user_intent VARCHAR(50),
          stage VARCHAR(50),
          severity VARCHAR(20),
          confidence DECIMAL(3,2),
          reason TEXT,
          raw_response JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_feedback_id (feedback_id),
          INDEX idx_created_at (created_at),
          INDEX idx_severity (severity)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      console.log('processed_data.ai_analysis table created')
    }

    await connection.end()
    console.log('Database initialization completed')
    process.exit(0)
  } catch (error) {
    console.error('Database initialization failed:', error.message)
    process.exit(1)
  }
}

initDB()
