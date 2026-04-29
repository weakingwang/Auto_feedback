import express from 'express'
import { rawDB } from '../utils/database.js'

const router = express.Router()

const LABELS = {
  problemType: {
    cannot_use: '功能不可用',
    cannot_understand: '操作不理解',
    not_good_enough: '效果不够好',
    unknown: '未知'
  },
  rootCause: {
    bug_error: '功能异常',
    usability_issue: '使用体验',
    ai_quality_issue: 'AI质量',
    performance_issue: '性能问题',
    product_gap: '功能缺失',
    other: '其他',
    unknown: '未知'
  },
  featureModule: {
    model_switch: '模型切换',
    code_generate: '代码生成',
    editor: '编辑器',
    run_preview: '运行预览',
    claude_init: '初始化',
    project_setup: '项目设置',
    unknown: '未知'
  },
  userIntent: {
    create_project: '新建项目',
    generate_code: '生成代码',
    modify_code: '修改代码',
    run_project: '运行项目',
    fix_error: '修复错误',
    learn_usage: '学习使用',
    unknown: '未知'
  },
  stage: {
    start_phase: '开始阶段',
    input_phase: '输入阶段',
    generation_phase: '生成阶段',
    post_generation: '生成后',
    run_phase: '运行阶段',
    unknown: '未知'
  },
  severity: {
    high: '高',
    medium: '中',
    low: '低',
    unknown: '未知'
  }
}

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const buildFeedbackFilters = (query) => {
  const conditions = []
  const params = []

  const add = (condition, ...values) => {
    conditions.push(condition)
    params.push(...values)
  }

  if (query.problem_type) add('f.problem_type = ?', query.problem_type)
  if (query.root_cause) add('a.root_cause = ?', query.root_cause)
  if (query.feature_module) add('a.feature_module = ?', query.feature_module)
  if (query.user_intent) add('a.user_intent = ?', query.user_intent)
  if (query.stage) add('a.stage = ?', query.stage)
  if (query.severity) add('a.severity = ?', query.severity)
  if (query.date_from) add('DATE(f.created_at) >= ?', query.date_from)
  if (query.date_to) add('DATE(f.created_at) <= ?', query.date_to)
  if (query.has_analysis === 'true') add('a.id IS NOT NULL')
  if (query.has_analysis === 'false') add('a.id IS NULL')
  if (query.keyword) {
    add(
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

const renderBadge = (label, value) => {
  if (!value) return ''
  return `<span class="badge"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`
}

const renderLayout = (title, body) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --card: #ffffff;
      --text: #152033;
      --muted: #60708a;
      --line: #dde4f0;
      --accent: #2563eb;
      --accent-soft: #dbeafe;
      --danger: #dc2626;
      --warning: #d97706;
      --success: #16a34a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: linear-gradient(180deg, #eef3fb 0%, var(--bg) 100%);
      color: var(--text);
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    .hero, .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 12px 30px rgba(37, 99, 235, 0.06);
    }
    .hero {
      padding: 24px 28px;
      margin-bottom: 20px;
    }
    h1, h2, h3, p { margin: 0; }
    .subtitle {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 20px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
      color: var(--text);
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 10px;
      text-decoration: none;
      border: 1px solid transparent;
      font-size: 14px;
      cursor: pointer;
    }
    .button.primary {
      background: var(--accent);
      color: white;
    }
    .button.secondary {
      border-color: var(--line);
      color: var(--text);
      background: white;
    }
    .summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin: 18px 0 8px;
    }
    .summary .card {
      padding: 14px 16px;
      min-width: 160px;
    }
    .summary .value {
      margin-top: 6px;
      font-size: 24px;
      font-weight: 700;
    }
    .list {
      display: grid;
      gap: 16px;
      margin-top: 20px;
    }
    .item {
      padding: 18px 20px;
    }
    .item-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
    }
    .title-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .tag {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .tag.high { background: #fee2e2; color: var(--danger); }
    .tag.medium { background: #ffedd5; color: var(--warning); }
    .tag.low { background: #dcfce7; color: var(--success); }
    .content {
      margin-top: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .section-title {
      margin-top: 16px;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .badge {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--text);
    }
    .images {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .images img {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid var(--line);
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
      margin-top: 18px;
    }
    .detail-card {
      padding: 18px 20px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #0f172a;
      color: #e2e8f0;
      padding: 14px;
      border-radius: 12px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
</body>
</html>`

router.get('/view', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const offset = (page - 1) * limit
    const { whereClause, params } = buildFeedbackFilters(req.query)

    const countSql = `
      SELECT COUNT(*) AS total
      FROM raw_data.feedbacks f
      LEFT JOIN processed_data.ai_analysis a ON a.feedback_id = f.id
      ${whereClause}
    `
    const [countRows] = await rawDB.execute(countSql, params)

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

    const query = new URLSearchParams(req.query)
    query.set('page', String(page))
    query.set('limit', String(limit))

    const listHtml = rows.length
      ? rows.map((row) => {
        const images = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]')
        return `
          <article class="card item">
            <div class="item-head">
              <div>
                <div class="title-row">
                  <h3>#${row.id} ${escapeHtml(LABELS.problemType[row.problem_type] || row.problem_type)}</h3>
                  ${row.severity ? `<span class="tag ${escapeHtml(row.severity)}">${escapeHtml(LABELS.severity[row.severity] || row.severity)}</span>` : ''}
                </div>
                <div class="meta">${escapeHtml(new Date(row.created_at).toLocaleString('zh-CN'))}</div>
              </div>
              <a class="button secondary" href="/api/admin/feedbacks/trace/${row.id}">查看追溯详情</a>
            </div>
            <div class="section-title">用户原始反馈</div>
            <div class="content">${escapeHtml(row.issue_text || '')}</div>
            <div class="section-title">补充上下文</div>
            <div class="content">${escapeHtml(row.context_text || '无')}</div>
            <div class="section-title">AI 分类结果</div>
            <div class="badge-row">
              ${renderBadge('根因', LABELS.rootCause[row.root_cause] || row.root_cause)}
              ${renderBadge('模块', LABELS.featureModule[row.feature_module] || row.feature_module)}
              ${renderBadge('意图', LABELS.userIntent[row.user_intent] || row.user_intent)}
              ${renderBadge('阶段', LABELS.stage[row.stage] || row.stage)}
              ${renderBadge('置信度', row.confidence)}
            </div>
            <div class="section-title">AI 判断依据</div>
            <div class="content">${escapeHtml(row.reason || '无')}</div>
            ${images.length ? `<div class="section-title">用户截图</div><div class="images">${images.map((src) => `<a href="${escapeHtml(src)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(src)}" alt="反馈截图" /></a>`).join('')}</div>` : ''}
          </article>
        `
      }).join('')
      : '<div class="card item">没有匹配到反馈记录。</div>'

    const body = `
      <section class="hero">
        <h1>反馈追溯查询</h1>
        <p class="subtitle">按 AI 分类筛选原始反馈，并进入单条详情页核对用户原始信息。</p>
        <form method="GET" action="/api/admin/feedbacks/view">
          <div class="form-grid">
            <label>关键词<input name="keyword" value="${escapeHtml(req.query.keyword || '')}" placeholder="问题描述、联系方式、AI 原因" /></label>
            <label>问题类型<input name="problem_type" value="${escapeHtml(req.query.problem_type || '')}" placeholder="cannot_use" /></label>
            <label>根因<input name="root_cause" value="${escapeHtml(req.query.root_cause || '')}" placeholder="bug_error" /></label>
            <label>模块<input name="feature_module" value="${escapeHtml(req.query.feature_module || '')}" placeholder="run_preview" /></label>
            <label>用户意图<input name="user_intent" value="${escapeHtml(req.query.user_intent || '')}" placeholder="generate_code" /></label>
            <label>阶段<input name="stage" value="${escapeHtml(req.query.stage || '')}" placeholder="generation_phase" /></label>
            <label>严重度<input name="severity" value="${escapeHtml(req.query.severity || '')}" placeholder="high" /></label>
            <label>开始日期<input type="date" name="date_from" value="${escapeHtml(req.query.date_from || '')}" /></label>
            <label>结束日期<input type="date" name="date_to" value="${escapeHtml(req.query.date_to || '')}" /></label>
            <label>仅看已分析<select name="has_analysis">
              <option value="">全部</option>
              <option value="true" ${req.query.has_analysis === 'true' ? 'selected' : ''}>是</option>
              <option value="false" ${req.query.has_analysis === 'false' ? 'selected' : ''}>否</option>
            </select></label>
            <label>每页数量<input name="limit" value="${escapeHtml(String(limit))}" /></label>
          </div>
          <div class="actions">
            <button class="button primary" type="submit">查询</button>
            <a class="button secondary" href="/api/admin/feedbacks/view">重置</a>
          </div>
        </form>
      </section>
      <section class="summary">
        <div class="card"><div>匹配总数</div><div class="value">${countRows[0].total}</div></div>
        <div class="card"><div>当前页</div><div class="value">${page}</div></div>
        <div class="card"><div>每页条数</div><div class="value">${limit}</div></div>
      </section>
      <section class="list">${listHtml}</section>
    `

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(renderLayout('反馈追溯查询', body))
  } catch (error) {
    console.error('管理页查询失败:', error)
    res.status(500).send(renderLayout('查询失败', `<div class="hero"><h1>查询失败</h1><p class="subtitle">${escapeHtml(error.message)}</p></div>`))
  }
})

router.get('/trace/:id', async (req, res) => {
  try {
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
      [req.params.id]
    )

    if (!rows.length) {
      res.status(404).send(renderLayout('未找到反馈', '<div class="hero"><h1>未找到反馈</h1></div>'))
      return
    }

    const row = rows[0]
    const images = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]')
    let rawResponse = null
    try {
      rawResponse = row.raw_response ? JSON.parse(row.raw_response) : null
    } catch {
      rawResponse = row.raw_response
    }

    const body = `
      <section class="hero">
        <h1>反馈追溯详情 #${row.id}</h1>
        <p class="subtitle">可以在这里核对用户原始反馈与 AI 结构化结果是否一致。</p>
        <div class="actions">
          <a class="button secondary" href="/api/admin/feedbacks/view">返回筛选页</a>
        </div>
      </section>
      <section class="detail-grid">
        <article class="card detail-card">
          <h2>原始反馈</h2>
          <div class="section-title">问题类型</div>
          <div class="content">${escapeHtml(LABELS.problemType[row.problem_type] || row.problem_type)}</div>
          <div class="section-title">问题描述</div>
          <div class="content">${escapeHtml(row.issue_text || '')}</div>
          <div class="section-title">补充上下文</div>
          <div class="content">${escapeHtml(row.context_text || '无')}</div>
          <div class="section-title">联系方式</div>
          <div class="content">${escapeHtml(row.contact || '无')}</div>
          <div class="section-title">提交信息</div>
          <div class="content">时间：${escapeHtml(new Date(row.created_at).toLocaleString('zh-CN'))}\nIP：${escapeHtml(row.ip_address || '无')}\nUA：${escapeHtml(row.user_agent || '无')}</div>
          ${images.length ? `<div class="section-title">用户截图</div><div class="images">${images.map((src) => `<a href="${escapeHtml(src)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(src)}" alt="反馈截图" /></a>`).join('')}</div>` : ''}
        </article>
        <article class="card detail-card">
          <h2>AI 结构化分析</h2>
          ${row.analysis_id ? `
            <div class="badge-row">
              ${renderBadge('根因', LABELS.rootCause[row.root_cause] || row.root_cause)}
              ${renderBadge('模块', LABELS.featureModule[row.feature_module] || row.feature_module)}
              ${renderBadge('意图', LABELS.userIntent[row.user_intent] || row.user_intent)}
              ${renderBadge('阶段', LABELS.stage[row.stage] || row.stage)}
              ${renderBadge('严重度', LABELS.severity[row.severity] || row.severity)}
              ${renderBadge('置信度', row.confidence)}
            </div>
            <div class="section-title">AI 判断依据</div>
            <div class="content">${escapeHtml(row.reason || '无')}</div>
            <div class="section-title">AI 原始返回</div>
            <pre>${escapeHtml(JSON.stringify(rawResponse, null, 2))}</pre>
          ` : '<div class="content">当前还没有对应的 AI 分析结果。</div>'}
        </article>
      </section>
    `

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(renderLayout(`反馈追溯详情 #${row.id}`, body))
  } catch (error) {
    console.error('详情页查询失败:', error)
    res.status(500).send(renderLayout('查询失败', `<div class="hero"><h1>查询失败</h1><p class="subtitle">${escapeHtml(error.message)}</p></div>`))
  }
})

export default router
