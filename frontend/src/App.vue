<template>
  <div class="guestbook-screen">
    <!-- 背景光束效果 -->
    <div class="beam-container">
      <div class="beam-left"></div>
      <div class="beam-right"></div>
    </div>

    <!-- 顶部导航 -->
    <nav class="top-nav">
      <div class="top-nav__inner">
        <div class="brand-mark">
          <div class="brand-mark__badge"><img src="./assets/logo.png" alt="logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.9rem;" /></div>
          <span class="brand-mark__text">zcode</span>
        </div>
        <div class="top-nav__links">
          <a href="#" class="nav-link">首页</a>
          <a href="#" class="nav-link">文档</a>
          <a href="#" class="nav-link">关于</a>
        </div>
      </div>
    </nav>

    <!-- 主内容区 -->
    <div class="layout-shell">
      <div class="layout-grid">
        <!-- 左栏：提交表单 -->
        <div class="hero-column">
          <div class="hero-copy">
            <h1 class="hero-title">
              Simple,<br />
              <span class="gradient-text">Fast,</span><br />
              Vibe-Ready
            </h1>
            <p class="hero-description">
              遇到问题或有建议？告诉我们，帮助我们改进产品。你的反馈将被AI分析并转化为可执行的问题报告。
            </p>
          </div>

          <FeedbackForm @submit-success="handleSubmitSuccess" />
        </div>

        <!-- 右栏：反馈列表 -->
        <div class="feed-column">
          <StatsSummary :stats="stats" />
          <FeedbackList ref="feedbackList" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import FeedbackForm from './components/FeedbackForm.vue'
import FeedbackList from './components/FeedbackList.vue'
import StatsSummary from './components/StatsSummary.vue'
import { getStats } from './utils/api'

const feedbackList = ref(null)
const stats = ref({
  total_count: 0,
  today_count: 0,
  problem_type_distribution: {},
  severity_distribution: {}
})

// 提交成功后刷新列表
const handleSubmitSuccess = () => {
  if (feedbackList.value) {
    feedbackList.value.refresh()
  }
  loadStats()
}

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await getStats()
    if (data.success) {
      stats.value = data.data
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

onMounted(() => {
  loadStats()
})
</script>
