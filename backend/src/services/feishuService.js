import axios from 'axios'
import { rawDB, processedDB } from '../utils/database.js'

const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL
const REPORT_PUBLIC_BASE_URL = (
  process.env.REPORT_PUBLIC_BASE_URL ||
  process.env.PUBLIC_BASE_URL ||
  'http://47.95.113.32'
).replace(/\/$/, '')

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
  }
}

const TAG_COLORS = {
  cannot_use: 'red',
  cannot_understand: 'blue',
  not_good_enough: 'orange',
  high: 'red',
  medium: 'orange',
  low: 'green',
  unknown: 'grey'
}

const ALERT_THRESHOLDS = {
  total_count: { ratio: 0.3, minDelta: 3 },
  high_severity_count: { ratio: 0.3, minDelta: 2 },
  type_count: { ratio: 0.4, minDelta: 2 }
}

const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const getShanghaiDateString = (date = new Date()) => SHANGHAI_DATE_FORMATTER.format(date)

const shiftDateString = (dateString, offsetDays) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day))
  next.setUTCDate(next.getUTCDate() + offsetDays)
  return getShanghaiDateString(next)
}

const getReportDateContext = () => {
  const today = getShanghaiDateString()
  const reportDate = shiftDateString(today, -1)
  const previousDate = shiftDateString(reportDate, -1)
  const avgStartDate = shiftDateString(reportDate, -7)

  return {
    reportDate,
    previousDate,
    avgStartDate,
    date_range: `${reportDate} 00:00-23:59`
  }
}

const toDailyCountMap = (rows, dayField = 'day', valueField = 'count') => rows.reduce((acc, row) => {
  acc[row[dayField]] = Number(row[valueField] || 0)
  return acc
}, {})

const toDailyNestedMap = (rows, dayField, categoryField, valueField = 'count') => rows.reduce((acc, row) => {
  const day = row[dayField]
  if (!acc[day]) {
    acc[day] = {}
  }
  acc[day][row[categoryField]] = Number(row[valueField] || 0)
  return acc
}, {})

const safeDivide = (numerator, denominator) => {
  if (!denominator) {
    return 0
  }
  return numerator / denominator
}

const percentage = (value, total) => Number((safeDivide(value, total) * 100).toFixed(1))

const buildDelta = (current, baseline) => {
  const delta = current - baseline
  const ratio = baseline === 0 ? (current > 0 ? 1 : 0) : delta / baseline
  return {
    current,
    baseline,
    delta,
    ratio: Number(ratio.toFixed(4))
  }
}

const averageFromDays = (map, days, valueSelector = (value) => value || 0) => {
  if (!days.length) {
    return 0
  }

  const sum = days.reduce((total, day, index) => total + valueSelector(map[day], day, index), 0)
  return Number((sum / days.length).toFixed(2))
}

const BAR_FILLED = '█'
const BAR_EMPTY = '░'

const detectAnomaly = ({ metricKey, label, delta, compareLabel, thresholdKey }) => {
  const threshold = ALERT_THRESHOLDS[thresholdKey]
  if (!threshold) {
    return null
  }

  const absRatio = Math.abs(delta.ratio)
  const absDelta = Math.abs(delta.delta)

  if (absRatio < threshold.ratio || absDelta < threshold.minDelta) {
    return null
  }

  const direction = delta.delta > 0 ? '上升' : '下降'
  return {
    metricKey,
    label,
    compareLabel,
    direction,
    ratio: delta.ratio,
    delta: delta.delta,
    message: `${label}较${compareLabel}${direction} ${Math.abs(delta.ratio * 100).toFixed(1)}%`
  }
}

const summarizeTypeDistribution = (rows, totalCount) => {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      key: row.problem_type,
      label: LABELS.problemType[row.problem_type] || row.problem_type,
      count: Number(row.count || 0),
      ratio: percentage(Number(row.count || 0), totalCount)
    }))
}

const summarizeRootCauses = (rows) => {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      key: row.root_cause,
      label: LABELS.rootCause[row.root_cause] || row.root_cause,
      count: Number(row.count || 0)
    }))
}

const summarizeGenericDistribution = (rows, keyField, labelMap) => {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      key: row[keyField],
      label: labelMap[row[keyField]] || row[keyField],
      count: Number(row.count || 0)
    }))
}

const buildTypeTrends = ({
  topTypes,
  previousTypeMap,
  sevenDayTypeMap,
  totalHistoryMap,
  previousTotal,
  priorDays
}) => {
  return topTypes.map((item) => {
    const yesterdayCount = Number(previousTypeMap[item.key] || 0)
    const sevenDayAvgCount = averageFromDays(
      sevenDayTypeMap,
      priorDays,
      (dayMap) => Number(dayMap?.[item.key] || 0)
    )
    const yesterdayRatio = percentage(yesterdayCount, previousTotal)
    const sevenDayAvgRatio = averageFromDays(
      sevenDayTypeMap,
      priorDays,
      (dayMap, day) => percentage(Number(dayMap?.[item.key] || 0), Number(totalHistoryMap[day] || 0))
    )

    return {
      key: item.key,
      label: item.label,
      count: item.count,
      ratio: item.ratio,
      vs_yesterday: {
        count: buildDelta(item.count, yesterdayCount),
        ratio: buildDelta(item.ratio, previousTotal ? yesterdayRatio : 0)
      },
      vs_7day_avg: {
        count: buildDelta(item.count, sevenDayAvgCount),
        ratio: buildDelta(item.ratio, sevenDayAvgRatio)
      }
    }
  })
}

const summarizeTrendDirection = (delta) => {
  if (delta.delta > 0) return '上升'
  if (delta.delta < 0) return '下降'
  return '持平'
}

const formatManagementTrendLine = (label, trend, unit = '条') => {
  const direction = summarizeTrendDirection(trend.vs_7day_avg)
  if (direction === '持平') {
    return `${label}基本持平`
  }

  return `${label}${direction} ${Math.abs(trend.vs_7day_avg.delta)}${unit}`
}

const formatManagementTypeTrend = (item) => {
  const direction = summarizeTrendDirection(item.vs_7day_avg.count)
  if (direction === '持平') {
    return `${item.label}占比稳定`
  }

  return `${item.label}${direction}，当前 ${item.count}条/${item.ratio}%`
}

const buildBar = (value, maxValue, width = 12) => {
  if (maxValue <= 0) {
    return BAR_EMPTY.repeat(width)
  }

  const filled = Math.max(1, Math.round((value / maxValue) * width))
  return `${BAR_FILLED.repeat(Math.min(width, filled))}${BAR_EMPTY.repeat(Math.max(0, width - filled))}`
}

const buildRatioBar = (ratio, width = 12) => {
  if (ratio <= 0) {
    return BAR_EMPTY.repeat(width)
  }

  const filled = Math.max(1, Math.round((ratio / 100) * width))
  return `${BAR_FILLED.repeat(Math.min(width, filled))}${BAR_EMPTY.repeat(Math.max(0, width - filled))}`
}

const buildTypeChartText = (items) => {
  if (!items.length) {
    return '昨日无新增反馈'
  }

  return items
    .map((item, index) => `${String(index + 1).padStart(2, '0')} ${item.label.padEnd(8, ' ')} ${buildRatioBar(item.ratio)} ${String(item.count).padStart(2, ' ')}条 ${String(item.ratio).padStart(5, ' ')}%`)
    .join('\n')
}

const buildSeverityChartText = (items) => {
  const labels = {
    high: '高',
    medium: '中',
    low: '低',
    unknown: '未知'
  }

  const ordered = ['high', 'medium', 'low', 'unknown'].map((severity) => {
    const match = items.find((item) => item.severity === severity)
    return {
      label: labels[severity],
      count: match?.count || 0
    }
  })

  const maxCount = Math.max(...ordered.map((item) => item.count), 0)

  return ordered
    .map((item) => `${item.label.padEnd(2, ' ')} ${buildBar(item.count, maxCount)} ${String(item.count).padStart(2, ' ')}条`)
    .join('\n')
}

const buildTypeBarFields = (items) => {
  if (!items.length) {
    return [
      {
        is_short: false,
        text: {
          tag: 'lark_md',
          content: '昨日无新增反馈'
        }
      }
    ]
  }

  return items.map((item) => ({
    is_short: false,
    text: {
      tag: 'lark_md',
      content: `<text_tag color='${TAG_COLORS[item.key] || 'grey'}'>${item.label}</text_tag>  \n<text_tag color='${TAG_COLORS[item.key] || 'grey'}'>${buildRatioBar(item.ratio, 14)}</text_tag> ${item.count}条 / ${item.ratio}%`
    }
  }))
}

const buildSeverityBarFields = (items) => {
  const severityOrder = ['high', 'medium', 'low', 'unknown']
  const severityLabels = {
    high: '高严重度',
    medium: '中严重度',
    low: '低严重度',
    unknown: '未知严重度'
  }
  const normalized = severityOrder.map((severity) => ({
    severity,
    label: severityLabels[severity],
    count: items.find((item) => item.severity === severity)?.count || 0
  }))
  const maxCount = Math.max(...normalized.map((item) => item.count), 0)

  return normalized.map((item) => ({
    is_short: false,
    text: {
      tag: 'lark_md',
      content: `<text_tag color='${TAG_COLORS[item.severity] || 'grey'}'>${item.label}</text_tag>  \n<text_tag color='${TAG_COLORS[item.severity] || 'grey'}'>${buildBar(item.count, maxCount, 14)}</text_tag> ${item.count}条`
    }
  }))
}

const buildTypeLegendFields = (items) => {
  if (!items.length) {
    return [
      {
        is_short: false,
        text: {
          tag: 'lark_md',
          content: '昨日无新增反馈'
        }
      }
    ]
  }

  return items.slice(0, 3).map((item) => ({
    is_short: true,
    text: {
      tag: 'lark_md',
      content: `<text_tag color='${TAG_COLORS[item.key] || 'grey'}'>${item.label}</text_tag>  \n${item.count}条 / ${item.ratio}%`
    }
  }))
}

const buildSeverityLegendFields = (items) => {
  const severityOrder = ['high', 'medium', 'low', 'unknown']
  const severityLabels = {
    high: '高严重度',
    medium: '中严重度',
    low: '低严重度',
    unknown: '未知严重度'
  }

  return severityOrder.map((severity) => {
    const match = items.find((item) => item.severity === severity)
    return {
      is_short: true,
      text: {
        tag: 'lark_md',
        content: `<text_tag color='${TAG_COLORS[severity] || 'grey'}'>${severityLabels[severity]}</text_tag>  \n${match?.count || 0}条`
      }
    }
  })
}

const getAnomalyFlags = ({ totalTrend, highSeverityTrend, typeTrends }) => {
  const flags = []

  const totalAvgFlag = detectAnomaly({
    metricKey: 'total_count',
    label: '总反馈数',
    delta: totalTrend.vs_7day_avg,
    compareLabel: '近7日均值',
    thresholdKey: 'total_count'
  })
  if (totalAvgFlag) flags.push(totalAvgFlag)

  const highAvgFlag = detectAnomaly({
    metricKey: 'high_severity_count',
    label: '高严重度反馈',
    delta: highSeverityTrend.vs_7day_avg,
    compareLabel: '近7日均值',
    thresholdKey: 'high_severity_count'
  })
  if (highAvgFlag) flags.push(highAvgFlag)

  for (const item of typeTrends) {
    const flag = detectAnomaly({
      metricKey: `${item.key}_count`,
      label: `${item.label}数量`,
      delta: item.vs_7day_avg.count,
      compareLabel: '近7日均值',
      thresholdKey: 'type_count'
    })
    if (flag) flags.push(flag)
  }

  return flags.sort((a, b) => Math.abs(b.ratio) - Math.abs(a.ratio)).slice(0, 3)
}

const getDailySummary = async () => {
  const { reportDate, previousDate, avgStartDate, date_range } = getReportDateContext()
  const priorDays = Array.from({ length: 7 }, (_, index) => shiftDateString(reportDate, -(index + 1))).reverse()

  try {
    const [
      totalRows,
      typeRows,
      severityRows,
      rootCauseRows,
      featureModuleRows,
      userIntentRows,
      stageRows,
      totalHistoryRows,
      typeHistoryRows,
      highSeverityHistoryRows
    ] = await Promise.all([
      rawDB.execute('SELECT COUNT(*) AS count FROM feedbacks WHERE DATE(created_at) = ?', [reportDate]),
      rawDB.execute(
        `SELECT problem_type, COUNT(*) AS count
         FROM feedbacks
         WHERE DATE(created_at) = ?
         GROUP BY problem_type`,
        [reportDate]
      ),
      processedDB.execute(
        `SELECT a.severity, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) = ?
         GROUP BY a.severity`,
        [reportDate]
      ),
      processedDB.execute(
        `SELECT a.root_cause, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) = ?
         GROUP BY a.root_cause`,
        [reportDate]
      ),
      processedDB.execute(
        `SELECT a.feature_module, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) = ?
         GROUP BY a.feature_module`,
        [reportDate]
      ),
      processedDB.execute(
        `SELECT a.user_intent, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) = ?
         GROUP BY a.user_intent`,
        [reportDate]
      ),
      processedDB.execute(
        `SELECT a.stage, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) = ?
         GROUP BY a.stage`,
        [reportDate]
      ),
      rawDB.execute(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM feedbacks
         WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY DATE(created_at)`,
        [avgStartDate, reportDate]
      ),
      rawDB.execute(
        `SELECT DATE(created_at) AS day, problem_type, COUNT(*) AS count
         FROM feedbacks
         WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY DATE(created_at), problem_type`,
        [avgStartDate, reportDate]
      ),
      processedDB.execute(
        `SELECT DATE(f.created_at) AS day, COUNT(*) AS count
         FROM ai_analysis a
         JOIN raw_data.feedbacks f ON f.id = a.feedback_id
         WHERE DATE(f.created_at) BETWEEN ? AND ?
           AND a.severity = 'high'
         GROUP BY DATE(f.created_at)`,
        [avgStartDate, reportDate]
      )
    ])

    const totalCount = Number(totalRows[0][0].count || 0)
    const problem_type_distribution = summarizeTypeDistribution(typeRows[0], totalCount)
    const severity_distribution = severityRows[0].map((row) => ({
      severity: row.severity,
      count: Number(row.count || 0)
    }))
    const root_cause_distribution = summarizeRootCauses(rootCauseRows[0])
    const feature_module_distribution = summarizeGenericDistribution(
      featureModuleRows[0],
      'feature_module',
      LABELS.featureModule
    )
    const user_intent_distribution = summarizeGenericDistribution(
      userIntentRows[0],
      'user_intent',
      LABELS.userIntent
    )
    const stage_distribution = summarizeGenericDistribution(
      stageRows[0],
      'stage',
      LABELS.stage
    )

    const totalHistoryMap = toDailyCountMap(totalHistoryRows[0])
    const typeHistoryMap = toDailyNestedMap(typeHistoryRows[0], 'day', 'problem_type')
    const highSeverityHistoryMap = toDailyCountMap(highSeverityHistoryRows[0])

    const previousTotal = Number(totalHistoryMap[previousDate] || 0)
    const sevenDayAvgTotal = averageFromDays(totalHistoryMap, priorDays)
    const highSeverityCount = Number(severity_distribution.find((item) => item.severity === 'high')?.count || 0)
    const previousHighSeverity = Number(highSeverityHistoryMap[previousDate] || 0)
    const sevenDayAvgHighSeverity = averageFromDays(highSeverityHistoryMap, priorDays)

    const top_problem_types = problem_type_distribution.slice(0, 3)
    const typeTrends = buildTypeTrends({
      topTypes: top_problem_types,
      previousTypeMap: typeHistoryMap[previousDate] || {},
      sevenDayTypeMap: typeHistoryMap,
      totalHistoryMap,
      previousTotal,
      priorDays
    })

    const totalTrend = {
      current: totalCount,
      vs_yesterday: buildDelta(totalCount, previousTotal),
      vs_7day_avg: buildDelta(totalCount, sevenDayAvgTotal)
    }
    const highSeverityTrend = {
      current: highSeverityCount,
      vs_yesterday: buildDelta(highSeverityCount, previousHighSeverity),
      vs_7day_avg: buildDelta(highSeverityCount, sevenDayAvgHighSeverity)
    }

    const anomaly_flags = getAnomalyFlags({
      totalTrend,
      highSeverityTrend,
      typeTrends
    })

    return {
      report_date: reportDate,
      date_range,
      total_count: totalCount,
      high_severity_count: highSeverityCount,
      problem_type_distribution,
      severity_distribution,
      root_cause_distribution,
      feature_module_distribution,
      user_intent_distribution,
      stage_distribution,
      top_problem_types,
      vs_yesterday: {
        total_count: totalTrend.vs_yesterday,
        high_severity_count: highSeverityTrend.vs_yesterday
      },
      vs_7day_avg: {
        total_count: totalTrend.vs_7day_avg,
        high_severity_count: highSeverityTrend.vs_7day_avg
      },
      anomaly_flags,
      trend_summary: {
        total_count: totalTrend,
        high_severity_count: highSeverityTrend,
        problem_types: typeTrends
      },
      comparison_context: {
        previous_date: previousDate,
        avg_start_date: avgStartDate,
        avg_end_date: previousDate
      }
    }
  } catch (error) {
    console.error('获取日报数据失败:', error)
    throw error
  }
}

const buildCompactDistributionLines = (items, emptyText = '- 暂无数据') => {
  if (!items.length) {
    return emptyText
  }

  return items
    .slice(0, 3)
    .map((item) => `- ${item.label}：${item.count}条`)
    .join('\n')
}

const buildTraceLinks = (reportDate) => {
  const dateQuery = `date_from=${reportDate}&date_to=${reportDate}`
  return {
    dailyList: `${REPORT_PUBLIC_BASE_URL}/api/admin/feedbacks/view?${dateQuery}`,
    analyzedList: `${REPORT_PUBLIC_BASE_URL}/api/admin/feedbacks/view?${dateQuery}&has_analysis=true`,
    highSeverityList: `${REPORT_PUBLIC_BASE_URL}/api/admin/feedbacks/view?${dateQuery}&severity=high`
  }
}

const buildChartElements = (reportData) => {
  return [
    {
      tag: 'column_set',
      columns: [
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          elements: [
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content: '**问题类型分布**'
              }
            },
            {
              tag: 'div',
              fields: buildTypeBarFields(reportData.problem_type_distribution)
            }
          ]
        },
        {
          tag: 'column',
          width: 'weighted',
          weight: 1,
          elements: [
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content: '**严重度分布**'
              }
            },
            {
              tag: 'div',
              fields: buildSeverityBarFields(reportData.severity_distribution)
            }
          ]
        }
      ]
    },
    {
      tag: 'div',
      fields: [
        ...buildTypeLegendFields(reportData.problem_type_distribution),
        ...buildSeverityLegendFields(reportData.severity_distribution)
      ]
    }
  ]
}

const generateCardMessage = async (data) => {
  const topTypeFields = data.top_problem_types.length
    ? data.top_problem_types.map((item) => ({
      is_short: true,
      text: {
        tag: 'lark_md',
        content: `<text_tag color='${TAG_COLORS[item.key] || 'grey'}'>${item.label}</text_tag>  \n${item.count}条 / ${item.ratio}%`
      }
    }))
    : [
      {
        is_short: false,
        text: {
          tag: 'lark_md',
          content: '昨日无新增反馈'
        }
      }
    ]

  const rootCauseLines = data.root_cause_distribution.length
    ? buildCompactDistributionLines(data.root_cause_distribution, '- 昨日无可分析根因')
    : '- 昨日无可分析根因'
  const featureModuleLines = buildCompactDistributionLines(
    data.feature_module_distribution,
    '- 昨日无可分析模块'
  )
  const userIntentLines = buildCompactDistributionLines(
    data.user_intent_distribution,
    '- 昨日无可分析意图'
  )
  const stageLines = buildCompactDistributionLines(
    data.stage_distribution,
    '- 昨日无可分析阶段'
  )

  const trendLines = [
    formatManagementTrendLine('总反馈', data.trend_summary.total_count, '条'),
    formatManagementTrendLine('高严重度', data.trend_summary.high_severity_count, '条'),
    ...data.trend_summary.problem_types.slice(0, 2).map((item) => formatManagementTypeTrend(item))
  ]

  const anomalyLines = data.anomaly_flags.length
    ? data.anomaly_flags.map((item) => `- ${item.message}`).join('\n')
    : '- 核心指标未出现明显异常波动'

  const zeroStateLine = data.total_count === 0
    ? '昨日无新增反馈，系统已正常完成统计任务。'
    : `共收集 ${data.total_count} 条反馈，其中高严重度 ${data.high_severity_count} 条。`

  const chartElements = buildChartElements(data)
  const traceLinks = buildTraceLinks(data.report_date)

  return {
    msg_type: 'interactive',
    card: {
      config: {
        wide_screen_mode: true
      },
      header: {
        title: {
          tag: 'plain_text',
          content: '用户反馈管理日报'
        },
        subtitle: {
          tag: 'plain_text',
          content: `统计范围：${data.date_range}`
        },
        template: data.anomaly_flags.length ? 'orange' : 'blue'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**日报说明**  \n${zeroStateLine}`
          }
        },
        ...chartElements,
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**总反馈数**  \n${data.total_count}条`
              }
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**高严重度数**  \n${data.high_severity_count}条`
              }
            },
            ...topTypeFields
          ]
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**趋势摘要**  \n- ${trendLines.join('\n- ')}`
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**异常提醒**  \n${anomalyLines}`
          }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              '**🔎 追溯入口**',
              `- [查看当日原始反馈](${traceLinks.dailyList})`,
              `- [查看已完成 AI 分析的反馈](${traceLinks.analyzedList})`,
              `- [查看高严重度反馈](${traceLinks.highSeverityList})`
            ].join('  \n')
          }
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**根因分布**  \n${rootCauseLines}`
          }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**🧩 模块分布**  \n${featureModuleLines}`
              }
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**🎯 用户意图**  \n${userIntentLines}`
              }
            },
            {
              is_short: true,
              text: {
                tag: 'lark_md',
                content: `**⏱️ 阶段分布**  \n${stageLines}`
              }
            }
          ]
        }
      ]
    }
  }
}

export const sendDailyReport = async () => {
  try {
    if (!FEISHU_WEBHOOK_URL) {
      throw new Error('FEISHU_WEBHOOK_URL is not configured')
    }

    const reportData = await getDailySummary()
    const cardMessage = await generateCardMessage(reportData)
    const response = await axios.post(FEISHU_WEBHOOK_URL, cardMessage)

    return {
      success: true,
      data: response.data,
      report: reportData
    }
  } catch (error) {
    console.error('飞书推送失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export { getDailySummary }

export default { sendDailyReport, getDailySummary }
