import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

export interface ApiErrorResponse {
  status: number
  message: string
  errors?: Record<string, string[]> | unknown
}

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Preparation for HttpOnly session cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: automatically attach Bearer token if present in localStorage
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sams_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Helper for standardized global error handling
export function parseApiError(err: unknown): ApiErrorResponse {
  if (axios.isAxiosError(err)) {
    const error = err as AxiosError<{ message?: string; error?: string; errors?: unknown }>
    const status = error.response?.status ?? 0

    if (status === 401) {
      return { status, message: 'Session expired or invalid credentials. Please log in again.' }
    }
    if (status === 403) {
      return { status, message: 'You do not have permission to perform this action.' }
    }
    if (status >= 500) {
      return { status, message: 'A server error occurred. Please try again later.' }
    }
    if (status === 0) {
      return { status, message: 'Failed to connect to server. Check your network connection.' }
    }

    const data = error.response?.data
    const serverMessage = data?.message || data?.error
    return {
      status,
      message: typeof serverMessage === 'string' ? serverMessage : 'Invalid request.',
      errors: data?.errors,
    }
  }

  if (err instanceof Error) {
    return { status: 0, message: err.message }
  }

  return { status: 0, message: 'An unexpected error occurred.' }
}

// Standard helper methods for HTTP requests
export const http = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const res = await apiClient.get<T>(url, config)
      return res.data
    } catch (err) {
      throw parseApiError(err)
    }
  },
  post: async <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const res = await apiClient.post<T>(url, body, config)
      return res.data
    } catch (err) {
      throw parseApiError(err)
    }
  },
  put: async <T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const res = await apiClient.put<T>(url, body, config)
      return res.data
    } catch (err) {
      throw parseApiError(err)
    }
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const res = await apiClient.delete<T>(url, config)
      return res.data
    } catch (err) {
      throw parseApiError(err)
    }
  },
}

export default apiClient