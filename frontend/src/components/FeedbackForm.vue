<template>
  <div class="glass-card composer-card">
    <div class="card-heading">
      <div class="card-heading__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </div>
      <div>
        <h2>提交反馈</h2>
        <p>描述你遇到的问题，并补充必要上下文与环境信息。</p>
      </div>
    </div>

    <form class="composer-form" @submit.prevent="handleSubmit">
      <div class="form-block">
        <label class="field-label">
          <span class="question-number">1</span>
          问题描述
          <span class="field-required-mark">*</span>
        </label>
        <div class="textarea-wrap has-upload-slot">
          <textarea
            v-model="form.issue_text"
            class="glass-input composer-textarea composer-textarea--compact"
            placeholder="请尽量描述清楚你遇到的问题。"
            maxlength="1000"
            required
          ></textarea>

          <ImageUploader
            v-model="form.images"
            :max-files="3"
            @error="handleImageError"
          />
        </div>
        <div class="form-inline-meta">
          <p class="field-helper">可补充截图，单张不超过 5MB，最多 3 张。</p>
          <span class="char-count" :class="{ 'is-alert': form.issue_text.length > 900 }">
            {{ form.issue_text.length }}/1000
          </span>
        </div>
        <p v-if="errors.issue_text" class="field-error">{{ errors.issue_text }}</p>
      </div>

      <div class="form-block">
        <label class="field-label">
          <span class="question-number">2</span>
          问题类型
          <span class="field-required-mark">*</span>
        </label>
        <div class="select-shell" :class="{ 'has-value': form.problem_type }">
          <span class="select-status-dot"></span>
          <select
            v-model="form.problem_type"
            class="glass-input select-input select-input--feedback"
            required
          >
            <option value="" disabled>请选择问题类型</option>
            <option value="cannot_use">不能使用 / 功能异常</option>
            <option value="cannot_understand">看不懂 / 不知道怎么操作</option>
            <option value="not_good_enough">结果不够好 / 不符合预期</option>
          </select>
        </div>
        <p v-if="errors.problem_type" class="field-error">{{ errors.problem_type }}</p>
      </div>

      <div class="form-block">
        <label class="field-label">
          <span class="question-number">3</span>
          {{ getDynamicLabel() }}
          <span class="field-required-mark">*</span>
        </label>
        <textarea
          v-model="form.context_text"
          class="glass-input composer-textarea--secondary dynamic-context-textarea"
          :placeholder="getDynamicPlaceholder()"
          maxlength="500"
          required
        ></textarea>
        <p v-if="errors.context_text" class="field-error">{{ errors.context_text }}</p>
      </div>

      <div class="form-block">
        <label class="field-label">
          <span class="question-number">4</span>
          您的 Z Code 版本号、操作系统信息
          <span class="field-required-mark">*</span>
        </label>
        <input
          v-model="form.environment_info"
          type="text"
          class="glass-input"
          placeholder="如版本号：Z Code 1.0.0，操作系统：Windows 11、Linux 等"
          maxlength="255"
          required
        />
        <p class="field-note">如版本号：Z Code 1.0.0，操作系统：Windows 11、Linux 等</p>
        <p v-if="errors.environment_info" class="field-error">{{ errors.environment_info }}</p>
      </div>

      <div class="form-block">
        <label class="field-label">
          <span class="question-number">5</span>
          联系方式
        </label>
        <input
          v-model="form.contact"
          type="text"
          class="glass-input"
          placeholder="选填，方便我们回访，例如微信、邮箱等"
          maxlength="100"
        />
        <p class="field-note">选填，不会展示在日报中，仅用于后续沟通。</p>
      </div>

      <button
        type="submit"
        class="btn-klein btn-klein--full"
        :disabled="isSubmitting"
        :class="{ 'is-success': submitSuccess }"
      >
        <span v-if="submitSuccess">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          提交成功
        </span>
        <span v-else-if="isSubmitting">提交中...</span>
        <span v-else>提交反馈</span>
      </button>

      <div class="card-footnote">
        <span class="card-footnote__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        </span>
        <span>反馈提交后会进入后台分析，并用于日报统计与问题追溯。</span>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import ImageUploader from './ImageUploader.vue'
import { submitFeedback } from '../utils/api'

const emit = defineEmits(['submit-success'])

const form = reactive({
  problem_type: '',
  issue_text: '',
  context_text: '',
  environment_info: '',
  contact: '',
  images: []
})

const errors = reactive({
  problem_type: '',
  issue_text: '',
  context_text: '',
  environment_info: ''
})

const isSubmitting = ref(false)
const submitSuccess = ref(false)

const dynamicLabels = {
  cannot_use: '你原本想做什么，实际哪里不能用了？',
  cannot_understand: '你在哪一步看不懂，或者不知道怎么继续？',
  not_good_enough: '你期待的结果是什么，当前差在哪里？',
  default: '补充信息'
}

const dynamicPlaceholders = {
  cannot_use: '例如：我想运行项目，但点击运行后一直报错 / 没有反应。',
  cannot_understand: '例如：我不知道下一步该点哪里，或者系统提示我看不懂。',
  not_good_enough: '例如：我希望生成登录页，但生成结果和预期差很多。',
  default: '请补充当时的操作、目标或预期结果。'
}

const getDynamicLabel = () => {
  if (!form.problem_type) return dynamicLabels.default
  return dynamicLabels[form.problem_type] || dynamicLabels.default
}

const getDynamicPlaceholder = () => {
  if (!form.problem_type) return dynamicPlaceholders.default
  return dynamicPlaceholders[form.problem_type] || dynamicPlaceholders.default
}

const handleImageError = (message) => {
  console.error('图片上传预校验失败:', message)
}

const validate = () => {
  let isValid = true
  errors.problem_type = ''
  errors.issue_text = ''
  errors.context_text = ''
  errors.environment_info = ''

  if (!form.issue_text.trim()) {
    errors.issue_text = '请输入问题描述'
    isValid = false
  } else if (form.issue_text.trim().length < 5) {
    errors.issue_text = '问题描述至少需要 5 个字符'
    isValid = false
  }

  if (!form.problem_type) {
    errors.problem_type = '请选择问题类型'
    isValid = false
  }

  if (!form.context_text.trim()) {
    errors.context_text = `请输入${getDynamicLabel().replace('？', '')}`
    isValid = false
  }

  if (!form.environment_info.trim()) {
    errors.environment_info = '请输入您的 Z Code 版本号、操作系统信息'
    isValid = false
  }

  return isValid
}

const resetForm = () => {
  form.problem_type = ''
  form.issue_text = ''
  form.context_text = ''
  form.environment_info = ''
  form.contact = ''
  form.images = []
}

const handleSubmit = async () => {
  if (!validate()) return

  isSubmitting.value = true
  submitSuccess.value = false

  try {
    const formData = new FormData()
    formData.append('problem_type', form.problem_type)
    formData.append('issue_text', form.issue_text.trim())
    formData.append('context_text', form.context_text.trim())
    formData.append('environment_info', form.environment_info.trim())
    formData.append('contact', form.contact.trim())

    form.images.forEach((image) => {
      formData.append('images', image.file)
    })

    const response = await submitFeedback(formData)

    if (response.success) {
      submitSuccess.value = true

      setTimeout(() => {
        resetForm()
        submitSuccess.value = false
      }, 2000)

      emit('submit-success')
    }
  } catch (error) {
    console.error('提交反馈失败:', error)
    const message = error?.response?.data?.message || '提交失败，请稍后重试'
    alert(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.dynamic-context-textarea::placeholder {
  font-size: 0.75rem;
  text-indent: 2em;
}
</style>
