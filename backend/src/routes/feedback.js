import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { rawDB, processedDB } from '../utils/database.js'
import { analyzeFeedback } from '../services/aiService.js'

const router = express.Router()
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('鍙厑璁镐笂浼?JPG/PNG 鍥剧墖'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024
  }
})

const uploadImages = (req, res, next) => {
  upload.array('images', 3)(req, res, (error) => {
    if (!error) {
      next()
      return
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: '鍗曞紶鍥剧墖涓嶈兘瓒呰繃 5MB'
        })
        return
      }

      res.status(400).json({
        success: false,
        message: '鍥剧墖涓婁紶澶辫触锛岃妫€鏌ュ浘鐗囧ぇ灏忓拰鏁伴噺'
      })
      return
    }

    res.status(400).json({
      success: false,
      message: error.message || '鍥剧墖涓婁紶澶辫触'
    })
  })
}

const buildFeedbackFilters = (query) => {
  const conditions = []
  const params = []

  const appendCondition = (condition, ...values) => {
    conditions.push(condition)
    params.push(...values)
  }

  if (query.problem_type) {
    appendCondition('f.problem_type = ?', query.problem_type)
  }
  if (query.root_cause) {
    appendCondition('a.root_cause = ?', query.root_cause)
  }
  if (query.feature_module) {
    appendCondition('a.feature_module = ?', query.feature_module)
  }
  if (query.user_intent) {
    appendCondition('a.user_intent = ?', query.user_intent)
  }
  if (query.stage) {
    appendCondition('a.stage = ?', query.stage)
  }
  if (query.severity) {
    appendCondition('a.severity = ?', query.severity)
  }
  if (query.date_from) {
    appendCondition('DATE(f.created_at) >= ?', query.date_from)
  }
  if (query.date_to) {
    appendCondition('DATE(f.created_at) <= ?', query.date_to)
  }
  if (query.feedback_id) {
    appendCondition('f.id = ?', query.feedback_id)
  }
  if (query.has_analysis === 'true') {
    appendCondition('a.id IS NOT NULL')
  }
  if (query.has_analysis === 'false') {
    appendCondition('a.id IS NULL')
  }
  if (query.keyword) {
    appendCondition(
      '(f.issue_text LIKE ? OR f.context_text LIKE ? OR f.environment_info LIKE ? OR f.contact LIKE ? OR a.reason LIKE ?)',
      `%${query.keyword}%`,
      `%${query.keyword}%`,
      `%${query.keyword}%`,
      `%${query.keyword}%`,
      `%${query.keyword}%`
    )
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

router.post('/', uploadImages, async (req, res) => {
  try {
    const { problem_type, issue_text, context_text, environment_info, contact } = req.body

    if (!problem_type || !issue_text || !context_text || !environment_info) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })
    }

    const imageUrls = req.files ? req.files.map((file) => `/uploads/${file.filename}`) : []

    const [result] = await rawDB.execute(
      `INSERT INTO feedbacks (problem_type, issue_text, context_text, environment_info, contact, images, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        problem_type,
        issue_text,
        context_text,
        environment_info,
        contact || null,
        JSON.stringify(imageUrls),
        req.ip,
        req.headers['user-agent']
      ]
    )

    const feedbackId = result.insertId
    const imagePaths = req.files
      ? req.files.map((file) => file.path || file.filename)
      : []

    analyzeFeedback(
      {
        problem_type,
        issue_text,
        context_text,
        environment_info
      },
      imagePaths
    ).then(async (analysisResult) => {
      if (analysisResult.success) {
        const data = analysisResult.data
        await processedDB.execute(
          `INSERT INTO ai_analysis (feedback_id, root_cause, feature_module, user_intent, stage, severity, confidence, reason, raw_response)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            feedbackId,
            data.root_cause,
            data.feature_module,
            data.user_intent,
            data.stage,
            data.severity,
            data.confidence,
            data.reason,
            JSON.stringify(data)
          ]
        )
        console.log(`鍙嶉 #${feedbackId} AI鍒嗘瀽瀹屾垚`)
      } else {
        console.error(`鍙嶉 #${feedbackId} AI鍒嗘瀽澶辫触:`, analysisResult.error)
      }
    }).catch((analysisError) => {
      console.error(`Feedback #${feedbackId} AI analysis exception:`, analysisError)
    })

    res.json({
      success: true,
      data: {
        id: feedbackId,
        message: '鍙嶉鎻愪氦鎴愬姛'
      }
    })
  } catch (error) {
    console.error('鎻愪氦鍙嶉澶辫触:', error)
    res.status(500).json({
      success: false,
      message: '鎻愪氦澶辫触锛岃绋嶅悗閲嶈瘯'
    })
  }
})

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const offset = (page - 1) * limit

    if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      })
    }

    const { whereClause, params } = buildFeedbackFilters(req.query)

    const countSql = `
      SELECT COUNT(*) AS total
      FROM raw_data.feedbacks f
      LEFT JOIN processed_data.ai_analysis a ON a.feedback_id = f.id
      ${whereClause}
    `
    const [countResult] = await rawDB.execute(countSql, params)

    const listSql = `
      SELECT
        f.id,
        f.problem_type,
        f.issue_text,
        f.context_text,
        f.environment_info,
        f.contact,
        f.images,
        f.created_at,
        a.id AS analysis_id,
        a.root_cause,
        a.feature_module,
        a.user_intent,
        a.stage,
        a.severity,
        a.confidence,
        a.reason
      FROM raw_data.feedbacks f
      LEFT JOIN processed_data.ai_analysis a ON a.feedback_id = f.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const [rows] = await rawDB.execute(listSql, params)

    res.json({
      success: true,
      data: {
        list: rows,
        total: countResult[0].total,
        page,
        limit,
        filters: {
          problem_type: req.query.problem_type || null,
          root_cause: req.query.root_cause || null,
          feature_module: req.query.feature_module || null,
          user_intent: req.query.user_intent || null,
          stage: req.query.stage || null,
          severity: req.query.severity || null,
          date_from: req.query.date_from || null,
          date_to: req.query.date_to || null,
          has_analysis: req.query.has_analysis || null,
          keyword: req.query.keyword || null
        }
      }
    })
  } catch (error) {
    console.error('鑾峰彇鍙嶉鍒楄〃澶辫触:', error)
    res.status(500).json({
      success: false,
      message: '鑾峰彇鍒楄〃澶辫触'
    })
  }
})

router.get('/trace/:id', async (req, res) => {
  try {
    const { id } = req.params

    const [rows] = await rawDB.execute(
      `SELECT
         f.*,
         a.id AS analysis_id,
         a.root_cause,
         a.feature_module,
         a.user_intent,
         a.stage,
         a.severity,
         a.confidence,
         a.reason,
         a.raw_response,
         a.created_at AS analysis_created_at
       FROM raw_data.feedbacks f
       LEFT JOIN processed_data.ai_analysis a ON a.feedback_id = f.id
       WHERE f.id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      })
    }

    const row = rows[0]
    let rawResponse = null
    try {
      rawResponse = row.raw_response ? JSON.parse(row.raw_response) : null
    } catch {
      rawResponse = row.raw_response
    }

    res.json({
      success: true,
      data: {
        feedback: {
          id: row.id,
          problem_type: row.problem_type,
          issue_text: row.issue_text,
          context_text: row.context_text,
          environment_info: row.environment_info,
          contact: row.contact,
          images: row.images,
          ip_address: row.ip_address,
          user_agent: row.user_agent,
          created_at: row.created_at
        },
        analysis: row.analysis_id
          ? {
            id: row.analysis_id,
            root_cause: row.root_cause,
            feature_module: row.feature_module,
            user_intent: row.user_intent,
            stage: row.stage,
            severity: row.severity,
            confidence: row.confidence,
            reason: row.reason,
            raw_response: rawResponse,
            created_at: row.analysis_created_at
          }
          : null
      }
    })
  } catch (error) {
    console.error('杩芥函鏌ヨ澶辫触:', error)
    res.status(500).json({
      success: false,
      message: '杩芥函鏌ヨ澶辫触'
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const [feedbackRows] = await rawDB.execute(
      'SELECT * FROM feedbacks WHERE id = ?',
      [id]
    )

    if (feedbackRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      })
    }

    const [analysisRows] = await processedDB.execute(
      'SELECT * FROM ai_analysis WHERE feedback_id = ?',
      [id]
    )

    res.json({
      success: true,
      data: {
        ...feedbackRows[0],
        analysis: analysisRows[0] || null
      }
    })
  } catch (error) {
    console.error('鑾峰彇鍙嶉璇︽儏澶辫触:', error)
    res.status(500).json({
      success: false,
      message: '鑾峰彇璇︽儏澶辫触'
    })
  }
})

export default router

