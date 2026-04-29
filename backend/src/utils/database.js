import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const createPool = (database) => {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
}

export const rawDB = createPool(process.env.DB_NAME_RAW || 'raw_data')
export const processedDB = createPool(process.env.DB_NAME_PROCESSED || 'processed_data')

const ensureRawSchema = async () => {
  const [columns] = await rawDB.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'feedbacks'
      AND COLUMN_NAME = 'environment_info'
  `)

  if (!columns.length) {
    await rawDB.execute(`
      ALTER TABLE feedbacks
      ADD COLUMN environment_info VARCHAR(255) NOT NULL DEFAULT '' AFTER context_text
    `)
  }
}

export const testConnection = async () => {
  try {
    await rawDB.execute('SELECT 1')
    await processedDB.execute('SELECT 1')
    await ensureRawSchema()
    console.log('数据库连接成功')
    return true
  } catch (error) {
    console.error('数据库连接失败:', error)
    return false
  }
}

export default { rawDB, processedDB, testConnection }
