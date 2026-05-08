import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  accent?: 'default' | 'green' | 'amber' | 'blue'
}

const accentMap = {
  default: 'bg-muted text-foreground',
  green:   'bg-emerald-500/10 text-emerald-500',
  amber:   'bg-amber-500/10 text-amber-500',
  blue:    'bg-blue-500/10 text-blue-500',
}

export function StatCard({ label, value, sub, icon: Icon, accent = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`p-2 rounded-lg ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}