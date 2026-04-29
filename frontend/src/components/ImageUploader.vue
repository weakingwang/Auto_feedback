<template>
  <div class="upload-widget">
    <input
      ref="fileInput"
      type="file"
      class="hidden-file-input"
      accept="image/jpeg,image/png,image/jpg"
      multiple
      @change="handleFileChange"
    />

    <!-- 上传按钮 -->
    <div
      v-if="modelValue.length < maxFiles"
      class="upload-action-card"
      @click="$refs.fileInput.click()"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p>上传图片</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="upload-error-toast">
      {{ errorMessage }}
    </div>

    <!-- 图片预览 -->
    <div v-if="modelValue.length > 0" class="upload-preview">
      <div
        v-for="(image, index) in modelValue"
        :key="index"
        class="upload-preview__item"
      >
        <img :src="image.preview" :alt="`预览图 ${index + 1}`" />
        <button
          type="button"
          class="upload-preview__remove"
          @click="removeImage(index)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  maxFiles: {
    type: Number,
    default: 3
  },
  maxSize: {
    type: Number,
    default: 5 * 1024 * 1024 // 5MB
  }
})

const emit = defineEmits(['update:modelValue', 'error'])

const fileInput = ref(null)
const errorMessage = ref('')

const handleFileChange = (event) => {
  const files = Array.from(event.target.files)
  errorMessage.value = ''

  // 检查剩余可上传数量
  const remainingSlots = props.maxFiles - props.modelValue.length
  if (files.length > remainingSlots) {
    errorMessage.value = `最多只能上传 ${props.maxFiles} 张图片`
    emit('error', errorMessage.value)
    return
  }

  const newImages = []

  for (const file of files) {
    // 检查文件类型
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      errorMessage.value = '只支持 JPG/PNG 格式的图片'
      emit('error', errorMessage.value)
      continue
    }

    // 检查文件大小
    if (file.size > props.maxSize) {
      errorMessage.value = '单张图片不能超过 5MB'
      emit('error', errorMessage.value)
      continue
    }

    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      newImages.push({
        file: file,
        preview: e.target.result,
        name: file.name
      })

      // 所有文件处理完成后更新
      if (newImages.length === files.length || newImages.length > 0) {
        emit('update:modelValue', [...props.modelValue, ...newImages])
      }
    }
    reader.readAsDataURL(file)
  }

  // 清空 input，允许重复选择相同文件
  event.target.value = ''
}

const removeImage = (index) => {
  const newImages = [...props.modelValue]
  newImages.splice(index, 1)
  emit('update:modelValue', newImages)
  errorMessage.value = ''
}
</script>
