'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from '@/lib/nav'
import { useApp } from '@/lib/app-context'
import type { ApiErrorResponse } from '@/lib/apiClient'

interface FormValues {
  identity: string
  password: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8 // match backend password policy

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {}
  const identity = values.identity.trim()

  if (!identity) errors.identity = 'Email or username is required.'
  else if (identity.includes('@') && !EMAIL_RE.test(identity))
    errors.identity = 'Invalid email format.'

  if (!values.password) errors.password = 'Password is required.'
  else if (values.password.length < MIN_PASSWORD)
    errors.password = `Password must be at least ${MIN_PASSWORD} characters.`

  return errors
}

const inputBase =
  'w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 disabled:cursor-not-allowed'

const inputClass = (error?: string) =>
  error
    ? `${inputBase} border-red-300 focus:border-red-500 focus:ring-red-100`
    : `${inputBase} border-slate-300 focus:border-blue-600 focus:ring-blue-100`

export function LoginForm() {
  const router = useRouter()
  const { login } = useApp()

  const [values, setValues] = useState<FormValues>({ identity: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    // clear field error as user re-types
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (formError) setFormError('')
  }

  function handleBlur(field: keyof FormValues) {
    setErrors((prev) => ({ ...prev, [field]: validate(values)[field] }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    setFormError('')
    const nextErrors = validate(values)
    if (nextErrors.identity || nextErrors.password) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      // useApp().login() handles: API call → saveSession → setUser → setRole
      await login({
        identity: values.identity.trim(),
        password: values.password,
      })
      router.replace('/')
    } catch (err) {
      setFormError((err as ApiErrorResponse).message || 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      {/* Email / username */}
      <div>
        <label htmlFor="identity" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email or Username
        </label>
        <input
          id="identity"
          type="text"
          autoComplete="username"
          autoFocus
          disabled={submitting}
          value={values.identity}
          onChange={(e) => handleChange('identity', e.target.value)}
          onBlur={() => handleBlur('identity')}
          aria-invalid={Boolean(errors.identity)}
          aria-describedby={errors.identity ? 'identity-error' : undefined}
          placeholder="name@school.edu"
          className={inputClass(errors.identity)}
        />
        {errors.identity && (
          <p id="identity-error" className="mt-1.5 text-xs text-red-600">
            {errors.identity}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={submitting}
            value={values.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            placeholder="••••••••"
            className={`${inputClass(errors.password)} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-600"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="mt-1.5 text-xs text-red-600">
            {errors.password}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            Processing…
          </>
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  )
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}