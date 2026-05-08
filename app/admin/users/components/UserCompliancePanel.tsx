'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck, ShieldX, Loader2, CreditCard,
  Camera, MapPin, CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react'

interface ComplianceData {
  identificationType?: string
  ninNumber?:          string
  bvnNumber?:          string
  ninImageUrl?:        string
  faceImageUrl?:       string
  faceWithHandImageUrl?: string
  addressText?:        string
  addressProofUrl?:    string
  createdAt?:          string
  updatedAt?:          string
  activatedAt?:        string
}

interface ComplianceSections {
  identification: boolean
  passport:       boolean
  address:        boolean
}

interface Props {
  uid:      string
  fullname: string
}

export function UserCompliancePanel({ uid, fullname }: Props) {
  const [loading,  setLoading]  = useState(true)
  const [complete, setComplete] = useState(false)
  const [sections, setSections] = useState<ComplianceSections | null>(null)
  const [data,     setData]     = useState<ComplianceData | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setError(null)

    fetch(`/api/admin/users/compliance?uid=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error ?? 'Failed to load compliance')
        setComplete(json.complete)
        setSections(json.sections)
        setData(json.data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [uid])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5">
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {complete
            ? <ShieldCheck size={15} className="text-emerald-500" />
            : <ShieldX     size={15} className="text-muted-foreground" />}
          <p className="text-sm font-semibold text-foreground">Compliance Info</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          complete
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        }`}>
          {complete ? 'Verified' : 'Incomplete'}
        </span>
      </div>

      <div className="space-y-4 p-4">

        {/* Section status pills */}
        {sections && (
          <div className="flex flex-wrap gap-2">
            {([ 
              { key: 'identification', label: 'ID',       icon: <CreditCard size={11} /> },
              { key: 'passport',       label: 'Biometric', icon: <Camera     size={11} /> },
              { key: 'address',        label: 'Address',   icon: <MapPin     size={11} /> },
            ] as const).map(({ key, label, icon }) => (
              <div
                key={key}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                  sections[key]
                    ? 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {icon}
                {label}
                {sections[key]
                  ? <CheckCircle2 size={10} className="ml-0.5" />
                  : <XCircle      size={10} className="ml-0.5" />}
              </div>
            ))}
          </div>
        )}

        {/* No record at all */}
        {!data && (
          <p className="text-center text-xs text-muted-foreground py-4">
            No compliance record found for this user.
          </p>
        )}

        {data && (
          <div className="space-y-4">

            {/* ── Identification ── */}
            <Section title="Identification" icon={<CreditCard size={13} />} done={sections?.identification}>
              {data.identificationType ? (
                <div className="space-y-1.5">
                  <Row label="Type"   value={data.identificationType} />
                  {data.ninNumber && <Row label="NIN" value={maskId(data.ninNumber)} />}
                  {data.bvnNumber && <Row label="BVN" value={maskId(data.bvnNumber)} />}
                  {data.ninImageUrl && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-border">
                      <img
                        src={data.ninImageUrl}
                        alt="ID document"
                        className="h-28 w-full object-cover"
                      />
                      <div className="flex justify-end border-t border-border bg-muted/30 px-2 py-1">
                        <a
                          href={data.ninImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <ExternalLink size={10} /> View full
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Empty />
              )}
            </Section>

            {/* ── Biometric / Passport ── */}
            <Section title="Biometric Capture" icon={<Camera size={13} />} done={sections?.passport}>
              {data.faceImageUrl ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Face',        src: data.faceImageUrl },
                    { label: 'Face + Hand', src: data.faceWithHandImageUrl },
                  ].map(({ label, src }) => src ? (
                    <div key={label} className="overflow-hidden rounded-lg border border-border">
                      <img src={src} alt={label} className="h-24 w-full object-cover" />
                      <p className="border-t border-border bg-muted/30 py-1 text-center text-[10px] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ) : null)}
                </div>
              ) : (
                <Empty />
              )}
            </Section>

            {/* ── Address ── */}
            <Section title="Address" icon={<MapPin size={13} />} done={sections?.address}>
              {data.addressText ? (
                <div className="space-y-1.5">
                  <Row label="Address" value={data.addressText} multiline />
                  {data.addressProofUrl && (
                    <a
                      href={data.addressProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink size={11} /> View proof document
                    </a>
                  )}
                </div>
              ) : (
                <Empty />
              )}
            </Section>

            {/* ── Timestamps ── */}
            {(data.createdAt || data.activatedAt) && (
              <div className="border-t border-border pt-3 text-[10px] text-muted-foreground space-y-1">
                {data.createdAt   && <p>Submitted: {fmt(data.createdAt)}</p>}
                {data.activatedAt && <p className="text-emerald-600 dark:text-emerald-400">Activated: {fmt(data.activatedAt)}</p>}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({
  title, icon, done, children,
}: {
  title: string
  icon: React.ReactNode
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {icon} {title}
        </div>
        {done !== undefined && (
          done
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <XCircle      size={13} className="text-muted-foreground/50" />
        )}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className={`flex-1 font-medium text-foreground ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
        {value}
      </span>
    </div>
  )
}

function Empty() {
  return <p className="text-xs text-muted-foreground/60 italic">Not submitted</p>
}

function maskId(id: string): string {
  if (id.length <= 4) return '****'
  return '•'.repeat(id.length - 4) + id.slice(-4)
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}