<template>
  <div class="feed-column">
    <div class="feed-header">
      <div class="feed-header__title">
        <h2>反馈留言墙</h2>
        <span class="counter-pill">{{ total }} 条</span>
      </div>
    </div>

    <div class="feedback-list custom-scrollbar">
      <div v-if="loading" class="empty-state">
        <p>加载中...</p>
      </div>

      <div v-else-if="feedbacks.length === 0" class="empty-state">
        <p>还没有反馈，欢迎提交第一条。</p>
      </div>

      <template v-else>
        <div
          v-for="feedback in feedbacks"
          :key="feedback.id"
          class="glass-card feedback-card"
        >
          <div class="card-inner">
            <div class="feedback-card__meta">
              <div class="feedback-card__author">
                <div class="avatar-badge" :class="getAvatarClass(feedback.id)">
                  {{ getAvatarLetter(feedback.id) }}
                </div>
                <div>
                  <div class="feedback-card__id">用户 {{ getShortId(feedback.id) }}</div>
                  <div class="tag-row">
                    <span class="tag">{{ getProblemTypeLabel(feedback.problem_type) }}</span>
                  </div>
                </div>
              </div>
              <time class="feedback-card__time">{{ formatTime(feedback.created_at) }}</time>
            </div>

            <p class="feedback-card__message">{{ feedback.issue_text }}</p>

            <div v-if="normalizeImages(feedback.images).length" class="feedback-card__section">
              <span class="feedback-card__label">截图预览</span>
              <div class="feedback-images">
                <button
                  v-for="(img, idx) in normalizeImages(feedback.images)"
                  :key="`${feedback.id}-${idx}`"
                  type="button"
                  class="feedback-image-item"
                  @click="openImage(img)"
                >
                  <img :src="img" :alt="`反馈截图 ${idx + 1}`" loading="lazy" />
                </button>
              </div>
            </div>

            <div v-if="feedback.context_text" class="feedback-card__section">
              <span class="feedback-card__label">补充信息</span>
              <p class="feedback-card__context">{{ feedback.context_text }}</p>
            </div>

            <div v-if="feedback.environment_info" class="feedback-card__section">
              <span class="feedback-card__label">环境信息</span>
              <p class="feedback-card__context">{{ feedback.environment_info }}</p>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="load-more">
          <button class="ghost-action load-more__button" @click="loadMore" :disabled="loadingMore">
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getFeedbacks } from '../utils/api'

const feedbacks = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = 20
const total = ref(0)

const problemTypeLabels = {
  cannot_use: '不能使用 / 功能异常',
  cannot_understand: '看不懂 / 不知道怎么操作',
  not_good_enough: '结果不够好 / 不符合预期'
}

const avatarClasses = ['klein', 'soft', 'accent', 'muted']

const getProblemTypeLabel = (type) => problemTypeLabels[type] || type || '未知类型'

const getAvatarClass = (id) => {
  if (!id) return 'muted'
  return avatarClasses[id % avatarClasses.length]
}

const getAvatarLetter = (id) => {
  if (!id) return '?'
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return letters[id % letters.length]
}

const getShortId = (id) => {
  if (!id) return '...'
  return `#${String(id).padStart(4, '0')}`
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''

  const date = new Date(timeStr)
  const now = new Date()
  const diff = now - date

  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return minutes < 1 ? '刚刚' : `${minutes} 分钟前`
  }

  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours} 小时前`
  }

  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days} 天前`
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

const parseImages = (images) => {
  if (!images) return []
  if (Array.isArray(images)) return images

  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}

const normalizeImageUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return new URL(url, window.location.origin).toString()
}

const normalizeImages = (images) => parseImages(images).map(normalizeImageUrl).filter(Boolean)

const loadFeedbacks = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const response = await getFeedbacks({
      page: page.value,
      limit
    })

    if (response.success) {
      const newFeedbacks = response.data.list
      total.value = response.data.total

      if (isLoadMore) {
        feedbacks.value.push(...newFeedbacks)
      } else {
        feedbacks.value = newFeedbacks
      }

      hasMore.value = feedbacks.value.length < total.value
    }
  } catch (error) {
    console.error('加载反馈失败:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const openImage = (imgUrl) => {
  window.open(imgUrl, '_blank', 'noopener,noreferrer')
}

const loadMore = () => {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  loadFeedbacks(true)
}

const refresh = () => {
  page.value = 1
  loadFeedbacks(false)
}

defineExpose({ refresh })

onMounted(() => {
  loadFeedbacks()
})
</script>

<style scoped>
.feedback-card__id {
  color: #fff;
  font-weight: 600;
}

.feedback-images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.feedback-image-item {
  width: 6rem;
  height: 6rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.9rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.feedback-image-item:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.32);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
}

.feedback-image-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
