import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// auth token auto installed in every req after log
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sams_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient