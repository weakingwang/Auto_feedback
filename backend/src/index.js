import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import cron from 'node-cron'
import feedbackRoutes from './routes/feedback.js'
import adminFeedbackRoutes from './routes/adminFeedback.js'
import statsRoutes from './routes/stats.js'
import { testConnection } from './utils/database.js'
import { sendDailyReport } from './services/feishuService.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API路由
app.use('/api/feedback', feedbackRoutes)
app.use('/api/feedbacks', feedbackRoutes)
app.use('/api/admin/feedbacks', adminFeedbackRoutes)
app.use('/api/stats', statsRoutes)

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  })
})

// 启动服务器
const startServer = async () => {
  // 测试数据库连接
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('数据库连接失败，服务无法启动')
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`服务器启动成功，端口: ${PORT}`)
    console.log(`API地址: http://localhost:${PORT}`)
  })
}

// 配置定时任务（每天早上9点）
cron.schedule('0 9 * * *', async () => {
  console.log('执行定时任务: 发送日报')
  await sendDailyReport()
}, {
  timezone: 'Asia/Shanghai'
})
console.log('定时任务已配置: 每天09:00发送飞书日报')

// 手动触发飞书推送（测试用）
app.post('/api/admin/send-report', async (req, res) => {
  try {
    console.log('手动触发飞书推送')
    const result = await sendDailyReport()
    res.json(result)
  } catch (error) {
    console.error('手动推送失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

startServer()
