'use client'

import { useState } from 'react'
import { X, CheckCircle2, Copy, AlertCircle } from 'lucide-react'
import { buttonPrimary } from '@/components/ui-kit'

type CredentialsModalProps = {
  credentials: Array<{
    identifier: string
    identifierLabel: string
    password: string
    accountType: 'Student' | 'Parent'
  }>
  onClose: () => void
}

export function CredentialsModal({ credentials, onClose }: CredentialsModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        credentials
          .map(({ identifier, identifierLabel, password }) =>
            `${identifierLabel}: ${identifier}\nPassword: ${password}`,
          )
          .join('\n\n'),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const accountType = credentials[0]?.accountType ?? 'Student'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credentials-modal-title"
        className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h2 id="credentials-modal-title" className="text-lg font-bold text-ink">
                {accountType} Credentials
              </h2>
              <p className="text-xs text-muted">
                Save these credentials before closing this dialog.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-muted hover:text-ink transition"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 flex items-start gap-3">
            <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning leading-relaxed">
              <strong className="text-ink">Important:</strong> These credentials will not be shown again.
              Please save them securely and share them with the account holder.
            </p>
          </div>

          <div className="max-h-72 space-y-4 overflow-y-auto">
            {credentials.map((credential, index) => (
              <div
                key={`${credential.identifier}-${index}`}
                className="space-y-3 rounded-xl border border-line p-3"
              >
                {credentials.length > 1 && (
                  <p className="text-xs font-semibold text-ink">
                    {credential.accountType} {index + 1}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    {credential.identifierLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={credential.identifier}
                      readOnly
                      className="flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm font-mono text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(credential.identifier)}
                      className="rounded-xl border border-line bg-surface px-3 py-2 text-muted transition hover:text-ink"
                      title={`Copy ${credential.identifierLabel}`}
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Temporary Password</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={credential.password}
                      readOnly
                      className="flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm font-mono text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(credential.password)}
                      className="rounded-xl border border-line bg-surface px-3 py-2 text-muted transition hover:text-ink"
                      title="Copy password"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircle2 className="size-4 text-success" />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy All Credentials
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface p-4">
          <button type="button" onClick={onClose} className={buttonPrimary}>
            I've Saved the Credentials
          </button>
        </div>
      </div>
    </div>
  )
}
