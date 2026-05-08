'use client'

import { useState, useCallback } from 'react'
import { AnalyticsDoc, GlobalDoc } from '@/hooks/useAnalytics'
import { StatCard } from './Statcard'
import { PeriodChart, ChartDataPoint } from './Periodchart'
import { TimelinePicker, TimelineSelection } from './TimelinePicker'
import { formatDayLabel, getTodayId } from '@/hooks/useDateData'
import { Loader2, Calendar } from 'lucide-react'

interface DailyProps {
  docs:    AnalyticsDoc[]
  global:  GlobalDoc
  loading: boolean
}

async function fetchCustomDocs(ids: string[]): Promise<{ docs: AnalyticsDoc[]; global: GlobalDoc }> {
  const params = new URLSearchParams({ period: 'daily', start: ids[0], end: ids[ids.length-1] })
  const res = await fetch(`/api/admin/analytics?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return {
    docs:   (json.daily  ?? []) as AnalyticsDoc[],
    global: (json.global ?? { totalEscrow:0, totalPlatformFee:0, totalTransactions:0, updatedAt:null }) as GlobalDoc,
  }
}

function emptyDoc(id: string): AnalyticsDoc {
  return { id, usersSignedUp:0, totalWithdrawn:0, totalPaid:0, totalPaidCount:0, productsCreated:0, totalPlatformFee:0, updatedAt:null }
}

function ChartBlock({ data, title }: { data: ChartDataPoint[]; title: string }) {
  if (data.length < 2) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4 xl:p-5 overflow-x-auto">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground mb-4">{title}</p>
      <div className="min-w-[300px]"><PeriodChart data={data} height={260}/></div>
    </div>
  )
}

function StatGrid({ current, previous, label, globalFee, showGlobal=false }: {
  current: AnalyticsDoc; previous?: AnalyticsDoc; label?: string; globalFee: number; showGlobal?: boolean
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest">{label}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Users Signed Up"       value={current.usersSignedUp}    currentValue={current.usersSignedUp}    previousValue={previous?.usersSignedUp}    accent="info"        />
        <StatCard label="Escrow Paid In"        value={current.totalPaid}      currentValue={current.totalPaid}      previousValue={previous?.totalPaid}      isCurrency accent="primary"     />
        <StatCard label="Total Withdrawn"       value={current.totalWithdrawn}   currentValue={current.totalWithdrawn}   previousValue={previous?.totalWithdrawn}   isCurrency accent="success"     />
        <StatCard label="Products Created"      value={current.productsCreated}  currentValue={current.productsCreated}  previousValue={previous?.productsCreated}  accent="secondary"   />
        <StatCard label="Daily Platform Fee"     value={current.totalPlatformFee} currentValue={current.totalPlatformFee} previousValue={previous?.totalPlatformFee} isCurrency accent="destructive" />
        {showGlobal && (
          <StatCard label="Total Platform Fee (All-time)" value={globalFee} isCurrency accent="primary"/>
        )}
      </div>
    </div>
  )
}

export function Daily({ docs, global, loading }: DailyProps) {
  const [showTimeline,    setShowTimeline]    = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError,   setTimelineError]   = useState<string|null>(null)
  const [selection,       setSelection]       = useState<TimelineSelection|null>(null)
  const [customDocs,      setCustomDocs]      = useState<AnalyticsDoc[]>([])
  const [customGlobal,    setCustomGlobal]    = useState<GlobalDoc>(global)

  const handleSearch = useCallback(async (sel: TimelineSelection) => {
    setTimelineLoading(true); setTimelineError(null)
    try {
      const result = await fetchCustomDocs(sel.ids)
      const filled = sel.ids.map(id => result.docs.find(d=>d.id===id) ?? emptyDoc(id))
      setCustomDocs(filled); setCustomGlobal(result.global); setSelection(sel)
    } catch (e: any) { setTimelineError(e?.message ?? 'Failed to fetch') }
    finally { setTimelineLoading(false) }
  }, [])

  const handleClear = useCallback(() => { setSelection(null); setCustomDocs([]); setTimelineError(null) }, [])

  const sorted      = [...docs].sort((a,b)=>a.id.localeCompare(b.id))
  const currentId   = getTodayId()
  const current     = sorted.find(d=>d.id===currentId) ?? emptyDoc(currentId)
  const previous    = sorted.find(d=>d.id!==currentId)
  const defaultChart: ChartDataPoint[] = sorted
    .filter(d=>d.totalPaid>0||d.usersSignedUp>0||d.productsCreated>0)
    .map(d=>({ label:formatDayLabel(d.id), usersSignedUp:d.usersSignedUp, totalPaid:d.totalPaid, totalWithdrawn:d.totalWithdrawn, productsCreated:d.productsCreated }))

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>

  const renderContent = () => {
    if (!selection) return (
      <>
        <StatGrid current={current} previous={previous} globalFee={global.totalPlatformFee} showGlobal/>
        <ChartBlock data={defaultChart} title="Today vs Yesterday"/>
      </>
    )
    if (timelineLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>
    if (timelineError)   return <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{timelineError}</div>

    const sortedCustom = [...customDocs].sort((a,b)=>a.id.localeCompare(b.id))
    const customChart: ChartDataPoint[] = sortedCustom.map(d=>({ label:formatDayLabel(d.id), usersSignedUp:d.usersSignedUp, totalPaid:d.totalPaid, totalWithdrawn:d.totalWithdrawn, productsCreated:d.productsCreated }))

    if (selection.mode === 'view') {
      const doc = sortedCustom[0] ?? emptyDoc(selection.ids[0])
      return (
        <>
          <StatGrid current={doc} globalFee={customGlobal.totalPlatformFee} showGlobal/>
          <ChartBlock data={customChart} title={formatDayLabel(doc.id)}/>
        </>
      )
    }

    const docA = sortedCustom[0] ?? emptyDoc(selection.ids[0])
    const docB = sortedCustom[1] ?? emptyDoc(selection.ids[1])
    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4"><StatGrid current={docA} label={`A · ${formatDayLabel(docA.id)}`} globalFee={customGlobal.totalPlatformFee}/></div>
          <div className="rounded-xl border border-border bg-card p-4"><StatGrid current={docB} label={`B · ${formatDayLabel(docB.id)}`} globalFee={customGlobal.totalPlatformFee}/></div>
        </div>
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Δ Change A → B</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <StatCard label="Users Signed Up"       value={docB.usersSignedUp}    currentValue={docB.usersSignedUp}    previousValue={docA.usersSignedUp}    accent="info"        />
            <StatCard label="Escrow Paid In"        value={docB.totalPaid}      currentValue={docB.totalPaid}      previousValue={docA.totalPaid}      isCurrency accent="primary"     />
            <StatCard label="Total Withdrawn"       value={docB.totalWithdrawn}   currentValue={docB.totalWithdrawn}   previousValue={docA.totalWithdrawn}   isCurrency accent="success"     />
            <StatCard label="Products Created"      value={docB.productsCreated}  currentValue={docB.productsCreated}  previousValue={docA.productsCreated}  accent="secondary"   />
            <StatCard label="Daily Platform Fee"     value={docB.totalPlatformFee} currentValue={docB.totalPlatformFee} previousValue={docA.totalPlatformFee} isCurrency accent="destructive" />
          </div>
        </div>
        <ChartBlock data={customChart} title={`${formatDayLabel(docA.id)} vs ${formatDayLabel(docB.id)}`}/>
      </>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {renderContent()}
      <button onClick={()=>{ setShowTimeline(t=>!t); if(showTimeline) handleClear() }}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground
          transition-colors px-3 py-2 rounded-lg border border-border hover:bg-muted
          w-full sm:w-auto justify-center sm:justify-start">
        <Calendar className="w-3.5 h-3.5"/>
        {showTimeline ? 'Hide timeline' : 'Browse timeline'}
      </button>
      {showTimeline && (
        <div className="max-w-sm">
          <TimelinePicker period="daily" onSearch={handleSearch} onClear={handleClear} loading={timelineLoading}/>
        </div>
      )}
    </div>
  )
}