import express from 'express'
import { rawDB, processedDB } from '../utils/database.js'

const router = express.Router()

// 获取统计摘要
router.get('/summary', async (req, res) => {
  try {
    // 获取总反馈数
    const [totalResult] = await rawDB.execute(
      'SELECT COUNT(*) as count FROM feedbacks'
    )

    // 获取今日反馈数
    const today = new Date().toISOString().split('T')[0]
    const [todayResult] = await rawDB.execute(
      'SELECT COUNT(*) as count FROM feedbacks WHERE DATE(created_at) = ?',
      [today]
    )

    // 获取问题类型分布
    const [typeResult] = await rawDB.execute(
      `SELECT problem_type, COUNT(*) as count
       FROM feedbacks
       GROUP BY problem_type`
    )

    // 获取严重程度分布（从AI分析表）
    const [severityResult] = await processedDB.execute(
      `SELECT severity, COUNT(*) as count
       FROM ai_analysis
       GROUP BY severity`
    )

    // 转换为对象格式
    const typeDistribution = {}
    typeResult.forEach(item => {
      typeDistribution[item.problem_type] = item.count
    })

    const severityDistribution = {}
    severityResult.forEach(item => {
      severityDistribution[item.severity] = item.count
    })

    res.json({
      success: true,
      data: {
        total_count: totalResult[0].count,
        today_count: todayResult[0].count,
        problem_type_distribution: typeDistribution,
        severity_distribution: severityDistribution
      }
    })
  } catch (error) {
    console.error('获取统计失败:', error)
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    })
  }
})

export default router
