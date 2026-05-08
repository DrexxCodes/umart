'use client'

import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle2, Loader2, ChevronDown } from 'lucide-react'
import { ComplianceFileUpload } from './ComplianceFileUpload'
import { SectionShell } from './SectionShell'

interface IdentificationSectionProps {
  token:      string
  initial?:   any
  onComplete: (done: boolean) => void
}

export function IdentificationSection({ token, initial, onComplete }: IdentificationSectionProps) {
  const [idType,          setIdType]          = useState<'NIN' | 'BVN' | ''>(initial?.identificationType ?? '')
  const [ninNumber,       setNinNumber]       = useState(initial?.ninNumber ?? '')
  const [bvnNumber,       setBvnNumber]       = useState(initial?.bvnNumber ?? '')
  const [ninImageUrl,     setNinImageUrl]     = useState(initial?.ninImageUrl ?? '')
  const [ninImagePublicId,setNinImagePublicId]= useState(initial?.ninImagePublicId ?? '')
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const isComplete = idType === 'NIN'
    ? Boolean(ninNumber.trim() && ninImageUrl)
    : idType === 'BVN'
    ? Boolean(bvnNumber.trim())
    : false

  useEffect(() => { onComplete(isComplete) }, [isComplete, onComplete])

  async function handleSave() {
    if (!isComplete) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/users/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          section: 'identification', identificationType: idType,
          ninNumber: ninNumber || null, bvnNumber: bvnNumber || null,
          ninImageUrl: ninImageUrl || null, ninImagePublicId: ninImagePublicId || null,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionShell
      icon={<CreditCard size={16} />}
      title="Means of Identification"
      complete={isComplete}
    >
      {/* ID type selector */}
      <div className="relative">
        <select
          value={idType}
          onChange={(e) => { setIdType(e.target.value as any); setNinNumber(''); setBvnNumber('') }}
          className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
        >
          <option value="">Select ID type…</option>
          <option value="NIN">National Identification Number (NIN)</option>
          <option value="BVN">Bank Verification Number (BVN)</option>
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* NIN fields */}
      {idType === 'NIN' && (
        <div className="space-y-3">
          <input
            type="text" inputMode="numeric" maxLength={11}
            value={ninNumber}
            onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter your 11-digit NIN"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
          />
          <ComplianceFileUpload
            label="Upload NIN slip / document"
            hint="PNG, JPG or PDF · Max 10 MB"
            accept="image/jpeg,image/png,application/pdf"
            value={ninImageUrl}
            onChange={(url, pid) => { setNinImageUrl(url); setNinImagePublicId(pid) }}
            onClear={() => { setNinImageUrl(''); setNinImagePublicId('') }}
          />
        </div>
      )}

      {/* BVN field */}
      {idType === 'BVN' && (
        <input
          type="text" inputMode="numeric" maxLength={11}
          value={bvnNumber}
          onChange={(e) => setBvnNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter your 11-digit BVN"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isComplete && (
        <button
          onClick={handleSave} disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Identification'}
        </button>
      )}
    </SectionShell>
  )
}