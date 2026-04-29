import axios from 'axios'

// API基础配置
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000
})

// 提交反馈
export const submitFeedback = async (formData) => {
  const response = await api.post('/feedback', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

// 获取反馈列表
export const getFeedbacks = async (params = {}) => {
  const response = await api.get('/feedbacks', { params })
  return response.data
}

// 获取单条反馈详情
export const getFeedback = async (id) => {
  const response = await api.get(`/feedbacks/${id}`)
  return response.data
}

// 获取统计数据
export const getStats = async () => {
  const response = await api.get('/stats/summary')
  return response.data
}

export default api
