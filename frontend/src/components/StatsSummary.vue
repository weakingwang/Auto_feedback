<template>
  <div class="glass-card summary-card">
    <div class="summary-card__eyebrow">数据概览</div>

    <div class="summary-grid">
      <div class="summary-grid__item">
        <p class="summary-grid__label">总反馈数</p>
        <span class="summary-grid__value">{{ stats.total_count || 0 }}</span>
        <p class="summary-grid__hint">累计收到</p>
      </div>

      <div class="summary-grid__item">
        <p class="summary-grid__label">今日反馈</p>
        <span class="summary-grid__value">{{ stats.today_count || 0 }}</span>
        <p class="summary-grid__hint">24小时内</p>
      </div>

      <div class="summary-grid__item">
        <p class="summary-grid__label">高优先级</p>
        <span class="summary-grid__value" style="color: #fb7185;">
          {{ getSeverityCount('high') }}
        </span>
        <p class="summary-grid__hint">需重点关注</p>
      </div>

      <div class="summary-grid__item">
        <p class="summary-grid__label">问题类型</p>
        <div class="summary-grid__hint" style="margin-top: 0.5rem; line-height: 1.6;">
          <div v-if="hasProblemTypeData">
            <div v-for="(count, type) in topProblemTypes" :key="type">
              {{ getProblemTypeLabel(type) }}: {{ count }}
            </div>
          </div>
          <span v-else>暂无数据</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({
      total_count: 0,
      today_count: 0,
      problem_type_distribution: {},
      severity_distribution: {}
    })
  }
})

const problemTypeLabels = {
  cannot_use: '功能不可用',
  cannot_understand: '操作不理解',
  not_good_enough: '效果不够好'
}

const getProblemTypeLabel = (type) => {
  return problemTypeLabels[type] || type
}

const getSeverityCount = (severity) => {
  if (!props.stats.severity_distribution) return 0
  return props.stats.severity_distribution[severity] || 0
}

const hasProblemTypeData = computed(() => {
  return Object.keys(props.stats.problem_type_distribution || {}).length > 0
})

const topProblemTypes = computed(() => {
  const distribution = props.stats.problem_type_distribution || {}
  // 按数量排序，取前3个
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})
})
</script>
