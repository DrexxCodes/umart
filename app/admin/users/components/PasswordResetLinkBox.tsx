'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, X } from 'lucide-react'

interface PasswordResetLinkBoxProps {
  link: string
  onDismiss: () => void
}

export default function PasswordResetLinkBox({ link, onDismiss }: PasswordResetLinkBoxProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback — select the text
      const el = document.getElementById('reset-link-input') as HTMLInputElement
      el?.select()
    }
  }

  return (
    <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        Password Reset Link Generated
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Copy and share this link with the user. It expires after one use.
      </p>

      <div className="flex items-center gap-2">
        <input
          id="reset-link-input"
          readOnly
          value={link}
          className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
        />
        <button
          onClick={handleCopy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            copied
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Open link"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}