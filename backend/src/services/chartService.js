import { createCanvas } from 'canvas'
import * as echarts from 'echarts'
import fs from 'fs'
import path from 'path'

const CHARTS_DIR = path.join(process.cwd(), 'uploads', 'charts')
const PUBLIC_BASE_URL = (
  process.env.REPORT_PUBLIC_BASE_URL ||
  process.env.PUBLIC_BASE_URL ||
  'http://47.95.113.32'
).replace(/\/$/, '')

const TYPE_COLORS = {
  cannot_use: '#ef4444',
  cannot_understand: '#3b82f6',
  not_good_enough: '#f97316',
  unknown: '#94a3b8'
}

const TYPE_LABELS = {
  cannot_use: '功能不可用',
  cannot_understand: '操作不理解',
  not_good_enough: '效果不够好',
  unknown: '未知'
}

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#22c55e',
  unknown: '#94a3b8'
}

const SEVERITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
  unknown: '未知'
}

const ensureChartsDir = () => {
  if (!fs.existsSync(CHARTS_DIR)) {
    fs.mkdirSync(CHARTS_DIR, { recursive: true })
  }
}

const saveChart = (canvas, prefix) => {
  ensureChartsDir()

  const filename = `${prefix}_${Date.now()}.png`
  const filepath = path.join(CHARTS_DIR, filename)

  fs.writeFileSync(filepath, canvas.toBuffer('image/png'))

  return {
    filename,
    filepath,
    relativeUrl: `/uploads/charts/${filename}`,
    publicUrl: `${PUBLIC_BASE_URL}/uploads/charts/${filename}`
  }
}

const createNoDataGraphic = (title) => ({
  type: 'group',
  left: 'center',
  top: 'middle',
  children: [
    {
      type: 'text',
      style: {
        text: title,
        fontSize: 18,
        fontWeight: 700,
        fill: '#0f172a',
        textAlign: 'center'
      },
      left: 'center',
      top: -18
    },
    {
      type: 'text',
      style: {
        text: '昨日无新增数据',
        fontSize: 14,
        fill: '#64748b',
        textAlign: 'center'
      },
      left: 'center',
      top: 18
    }
  ]
})

const generateTypePieChart = async (typeDistribution) => {
  const canvas = createCanvas(720, 420)
  const chart = echarts.init(canvas)

  const hasData = typeDistribution.some((item) => item.count > 0)
  const data = hasData
    ? typeDistribution.map((item) => ({
      value: item.count,
      name: TYPE_LABELS[item.key] || item.label || item.key,
      itemStyle: {
        color: TYPE_COLORS[item.key] || TYPE_COLORS.unknown
      }
    }))
    : [{ value: 1, name: '暂无数据', itemStyle: { color: '#e2e8f0' } }]

  chart.setOption({
    backgroundColor: '#ffffff',
    title: {
      text: '问题类型分布',
      left: 24,
      top: 18,
      textStyle: {
        color: '#0f172a',
        fontSize: 20,
        fontWeight: 700
      }
    },
    tooltip: hasData
      ? {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      }
      : undefined,
    legend: {
      bottom: 16,
      icon: 'circle',
      textStyle: {
        color: '#334155',
        fontSize: 12
      }
    },
    series: [
      {
        type: 'pie',
        radius: hasData ? ['38%', '66%'] : ['0%', '0%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3
        },
        label: hasData
          ? {
            formatter: '{b}\n{d}%',
            color: '#0f172a',
            fontSize: 12
          }
          : { show: false },
        data
      }
    ],
    graphic: hasData ? undefined : createNoDataGraphic('问题类型分布')
  })

  const result = saveChart(canvas, 'type_pie')
  chart.dispose()
  return result
}

const generateSeverityBarChart = async (severityDistribution) => {
  const canvas = createCanvas(720, 420)
  const chart = echarts.init(canvas)

  const data = ['high', 'medium', 'low', 'unknown'].map((severity) => {
    const match = severityDistribution.find((item) => item.severity === severity)
    return {
      severity,
      name: SEVERITY_LABELS[severity],
      value: match?.count || 0,
      itemStyle: {
        color: SEVERITY_COLORS[severity]
      }
    }
  })

  const hasData = data.some((item) => item.value > 0)

  chart.setOption({
    backgroundColor: '#ffffff',
    title: {
      text: '严重度分布',
      left: 24,
      top: 18,
      textStyle: {
        color: '#0f172a',
        fontSize: 20,
        fontWeight: 700
      }
    },
    grid: {
      left: 48,
      right: 24,
      top: 72,
      bottom: 48,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.name),
      axisLine: {
        lineStyle: {
          color: '#cbd5e1'
        }
      },
      axisLabel: {
        color: '#334155',
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      splitLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12
      }
    },
    tooltip: hasData
      ? {
        trigger: 'axis'
      }
      : undefined,
    series: [
      {
        type: 'bar',
        barWidth: '42%',
        data,
        label: {
          show: true,
          position: 'top',
          color: '#0f172a',
          fontSize: 12
        },
        itemStyle: {
          borderRadius: [8, 8, 0, 0]
        }
      }
    ],
    graphic: hasData ? undefined : createNoDataGraphic('严重度分布')
  })

  const result = saveChart(canvas, 'severity_bar')
  chart.dispose()
  return result
}

export const generateCharts = async (data) => {
  const [typeChart, severityChart] = await Promise.all([
    generateTypePieChart(data.problem_type_distribution || []),
    generateSeverityBarChart(data.severity_distribution || [])
  ])

  return {
    typeChart,
    severityChart
  }
}

export default { generateCharts }
