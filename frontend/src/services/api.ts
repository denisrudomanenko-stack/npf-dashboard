import axios from 'axios'
import { useToastStore } from '../stores/toastStore'

export const api = axios.create({
  baseURL: '/api/v1',
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if exists
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Set Content-Type for JSON, let axios handle FormData automatically
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // Handle 403 Forbidden - show toast with permission error
    if (error.response?.status === 403) {
      const message = error.response?.data?.detail ||
        'У вас недостаточно прав для выполнения этого действия'
      useToastStore.getState().show(message, 'warning')
    }

    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)
