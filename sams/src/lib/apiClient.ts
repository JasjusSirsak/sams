import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

export interface ApiErrorResponse {
  status: number
  code?: string
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
    const error = err as AxiosError<{ message?: string; error?: string; code?: string; errors?: unknown }>
    const status = error.response?.status ?? 0
    const data = error.response?.data
    const serverMessage = data?.message || data?.error
    const code = data?.code

    // Network error / no response
    if (status === 0 || !error.response) {
      return {
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Please check your internet connection.',
      }
    }

    // 400 Bad Request / Validation error
    if (status === 400) {
      return {
        status: 400,
        code: code || 'VALIDATION_ERROR',
        message: typeof serverMessage === 'string' ? serverMessage : 'Please check your input and try again.',
        errors: data?.errors,
      }
    }

    // 401 Unauthorized / Invalid credentials
    if (status === 401) {
      return {
        status: 401,
        code: code || 'INVALID_CREDENTIALS',
        message: typeof serverMessage === 'string' ? serverMessage : 'Incorrect username or password.',
      }
    }

    // 429 Too Many Requests
    if (status === 429) {
      return {
        status: 429,
        code: code || 'TOO_MANY_ATTEMPTS',
        message: typeof serverMessage === 'string' ? serverMessage : 'Too many attempts. Please try again in a moment.',
      }
    }

    // 403 Forbidden
    if (status === 403) {
      return {
        status: 403,
        code: code || 'FORBIDDEN',
        message: typeof serverMessage === 'string' ? serverMessage : 'You do not have permission to perform this action.',
      }
    }

    // 5xx Server Error
    if (status >= 500) {
      return {
        status,
        code: code || 'SERVER_ERROR',
        message: 'Something went wrong on the server. Please try again.',
      }
    }

    return {
      status,
      code,
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