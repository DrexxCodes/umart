'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Upload, AlertTriangle, Loader2, CheckCircle2,
  FileImage, FileVideo, Trash2, Search, ChevronDown,
  ShieldAlert, Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { auth } from '@/lib/firebase'
import { useBanks } from '@/hooks/useBanks'

interface Transaction {
  refId: string
  items: Array<{ productName: string; quantity: number; price: number }>
  grandPrice: number
}

interface DisputeDialogProps {
  transaction: Transaction
  onClose: () => void
  onSubmitted: () => void
  /** Called just before submission. Return true to proceed, false to block. */
  onBeforeSubmit?: (attachments: Attachment[]) => boolean
}

interface Attachment {
  url: string
  type: 'image' | 'video'
  name: string
  size: number
}

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''
const MAX_ATTACHMENTS = 5

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_PRESET)
  formData.append('folder', 'umart_disputes')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Cloudinary upload failed')
  const data = await res.json()
  return data.secure_url
}

export function DisputeDialog({ transaction, onClose, onSubmitted, onBeforeSubmit }: DisputeDialogProps) {
  const { banks, loading: banksLoading } = useBanks()

  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [bankCode, setBankCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false)
  const bankDropdownRef = useRef<HTMLDivElement>(null)
  const bankSearchRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (bankDropdownOpen) setTimeout(() => bankSearchRef.current?.focus(), 50)
  }, [bankDropdownOpen])

  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      setAccountName('')
      setResolveError('')
      return
    }
    let cancelled = false
    const resolve = async () => {
      try {
        setResolving(true)
        setResolveError('')
        setAccountName('')
        const user = auth.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch(
          `/api/payment/resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const result = await res.json()
        if (cancelled) return
        if (result.success && result.data?.account_name) {
          setAccountName(result.data.account_name)
        } else {
          setResolveError(result.error || 'Could not verify account.')
        }
      } catch {
        if (!cancelled) setResolveError('Failed to verify account.')
      } finally {
        if (!cancelled) setResolving(false)
      }
    }
    const t = setTimeout(resolve, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [bankCode, accountNumber])

  const selectBank = (code: string, name: string) => {
    setBankCode(code)
    setBankName(name)
    setBankSearch('')
    setBankDropdownOpen(false)
    setAccountName('')
    setResolveError('')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''

    setUploadError('')

    for (const file of files) {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')

      if (!isImage && !isVideo) {
        setUploadError('Only images and videos are allowed.')
        continue
      }

      const maxSize = isImage ? 5 * 1024 * 1024 : 20 * 1024 * 1024
      if (file.size > maxSize) {
        setUploadError(isImage ? 'Images must be under 5 MB.' : 'Videos must be under 20 MB.')
        continue
      }

      if (attachments.length >= MAX_ATTACHMENTS) {
        setUploadError(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`)
        break
      }

      try {
        setUploading(true)
        const url = await uploadToCloudinary(file)
        setAttachments((prev) => [
          ...prev,
          { url, type: isImage ? 'image' : 'video', name: file.name, size: file.size },
        ])
      } catch {
        setUploadError('Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const canSubmit =
    title.trim().length > 0 &&
    details.trim().length > 0 &&
    bankCode &&
    accountNumber.length === 10 &&
    accountName &&
    !submitting &&
    !uploading

  const handleSubmit = async () => {
    if (!canSubmit) return

    // Run pre-submit check (attachment warning)
    if (onBeforeSubmit) {
      const proceed = onBeforeSubmit(attachments)
      if (!proceed) return
    }

    try {
      setSubmitting(true)
      setSubmitError('')
      const user = auth.currentUser
      if (!user) { setSubmitError('You must be signed in.'); return }
      const token = await user.getIdToken()

      const res = await fetch('/api/dispute/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          txnId: transaction.refId,
          title: title.trim(),
          details: details.trim(),
          attachments: attachments.map(({ url, type }) => ({ url, type })),
          bankCode,
          bankName,
          accountNumber,
          accountName,
        }),
      })

      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Failed to submit dispute')

      onSubmitted()
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const productName = transaction.items?.[0]?.productName ?? 'this product'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">File a Dispute</h2>
              <p className="text-[10px] font-mono text-muted-foreground">{transaction.refId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">

          {/* Context banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Disputing <strong>{productName}</strong> — ₦{transaction.grandPrice.toLocaleString()}.
              Both Umart and the seller will be notified.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dispute Title <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Item not received, Wrong item delivered..."
              maxLength={120}
              className="rounded-xl"
            />
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dispute Details <span className="text-destructive">*</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened in detail. Be as specific as possible..."
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
            <p className="text-[10px] text-muted-foreground text-right">{details.length}/2000</p>
          </div>

          {/* Attachments — max 5 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supporting Evidence
              <span className="ml-1 font-normal text-muted-foreground/60">
                (up to {MAX_ATTACHMENTS} files — images ≤5 MB, videos ≤20 MB)
              </span>
            </label>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    {att.type === 'image'
                      ? <FileImage size={14} className="text-primary shrink-0" />
                      : <FileVideo size={14} className="text-primary shrink-0" />}
                    <span className="flex-1 text-xs text-foreground truncate">{att.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(att.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-3 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
            >
              {uploading
                ? <><Loader2 size={13} className="animate-spin" />Uploading...</>
                : attachments.length >= MAX_ATTACHMENTS
                ? <><CheckCircle2 size={13} className="text-emerald-500" />Maximum attachments reached</>
                : <><Upload size={13} />Click to upload images or videos ({attachments.length}/{MAX_ATTACHMENTS})</>}
            </button>
            {uploadError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle size={12} />{uploadError}
              </p>
            )}
          </div>

          {/* Bank account for refund */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Banknote size={14} className="text-primary" />
              <p className="text-xs font-semibold text-foreground">Refund Account Details</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide your bank account so we can process a refund if your dispute is approved.
            </p>

            {/* Bank dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bank <span className="text-destructive">*</span>
              </label>
              <div className="relative" ref={bankDropdownRef}>
                <button
                  type="button"
                  disabled={banksLoading}
                  onClick={() => setBankDropdownOpen((p) => !p)}
                  className="w-full flex items-center justify-between rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none disabled:opacity-50"
                >
                  <span className={bankCode ? 'text-foreground' : 'text-muted-foreground'}>
                    {banksLoading ? 'Loading banks…' : bankName || 'Select your bank…'}
                  </span>
                  <div className="flex items-center gap-1">
                    {banksLoading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                    {bankCode && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setBankCode(''); setBankName(''); setAccountName('') }}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                      >
                        <X size={13} />
                      </span>
                    )}
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {bankDropdownOpen && !banksLoading && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                        <input
                          ref={bankSearchRef}
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search banks…"
                          className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                      </div>
                    </div>
                    <ul className="max-h-40 overflow-y-auto py-1">
                      {filteredBanks.length === 0
                        ? <li className="px-3 py-2 text-xs text-muted-foreground text-center">No banks found</li>
                        : filteredBanks.map((bank, i) => (
                          <li
                            key={`${bank.code}-${i}`}
                            onClick={() => selectBank(bank.code, bank.name)}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors ${bank.code === bankCode ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                          >
                            {bank.name}
                          </li>
                        ))
                      }
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Account Number <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setAccountNumber(val)
                  setAccountName('')
                  setResolveError('')
                }}
                className="rounded-xl"
              />
            </div>

            {/* Account name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Account Name
              </label>
              <div className="relative">
                <Input
                  readOnly
                  value={resolving ? '' : accountName}
                  placeholder={
                    resolving ? 'Verifying…'
                    : accountNumber.length === 10 && bankCode ? (resolveError || 'Account name will appear here')
                    : 'Enter bank and account number above'
                  }
                  className={`rounded-xl bg-muted/50 cursor-default ${accountName ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''} ${resolveError ? 'border-destructive/50' : ''}`}
                />
                {resolving && <Loader2 size={14} className="absolute right-3 top-2.5 animate-spin text-muted-foreground" />}
                {accountName && !resolving && <CheckCircle2 size={14} className="absolute right-3 top-2.5 text-emerald-500" />}
              </div>
              {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}
            </div>
          </div>

          {submitError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle size={12} />{submitError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" />Submitting…</>
              : <><ShieldAlert size={14} />Submit Dispute</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
