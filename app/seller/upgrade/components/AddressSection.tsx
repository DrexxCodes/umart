'use client'

import { useState, useEffect } from 'react'
import { MapPin, CheckCircle2, Loader2 } from 'lucide-react'
import { ComplianceFileUpload } from './ComplianceFileUpload'
import { SectionShell } from './SectionShell'
import { NIGERIAN_STATES } from '@/hooks/useNigerianStates'

interface AddressSectionProps {
  token:      string
  initial?:   any
  onComplete: (done: boolean) => void
}

export function AddressSection({ token, initial, onComplete }: AddressSectionProps) {
  const [address,          setAddress]          = useState(initial?.addressText ?? '')
  const [proofUrl,         setProofUrl]         = useState(initial?.addressProofUrl ?? '')
  const [proofPublicId,    setProofPublicId]    = useState(initial?.addressProofPublicId ?? '')
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  const isComplete = Boolean(address.trim() && proofUrl)
  useEffect(() => { onComplete(isComplete) }, [isComplete, onComplete])

  async function handleSave() {
    if (!isComplete) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/users/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section: 'address', addressText: address.trim(), addressProofUrl: proofUrl, addressProofPublicId: proofPublicId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionShell icon={<MapPin size={16} />} title="Address Verification" complete={isComplete}>
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Enter your full residential address…"
        rows={3}
        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
      />

      <ComplianceFileUpload
        label="Proof of Address"
        hint="Utility bill, bank statement (≤ 6 months old) · PDF, JPG or PNG · Max 10 MB"
        accept="image/jpeg,image/png,application/pdf"
        value={proofUrl}
        onChange={(url, pid) => { setProofUrl(url); setProofPublicId(pid) }}
        onClear={() => { setProofUrl(''); setProofPublicId('') }}
      />

      <p className="text-[10px] text-muted-foreground">
        Accepted documents: electricity bill, water bill, waste bill, bank statement — dated within the last 6 months.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isComplete && (
        <button onClick={handleSave} disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : null}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Address'}
        </button>
      )}
    </SectionShell>
  )
}