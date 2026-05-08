'use client'

import { useState } from 'react'
import {
  User, Mail, Phone, Calendar, Shield, Ban,
  Trash2, KeyRound, ChevronDown, ChevronUp,
  ShieldCheck, ShieldOff, Loader2, AlertTriangle,
  FileText, X,
} from 'lucide-react'
import PasswordResetLinkBox from './PasswordResetLinkBox'
import { UserCompliancePanel } from './UserCompliancePanel'

export interface UserData {
  uid:      string
  username: string
  fullname: string
  email:    string
  phone:    string
  createdAt: string
  roles: {
    isCreator: boolean
    isAdmin:   boolean
  }
  restrictions: {
    isBanned:        boolean
    isCreatorBanned: boolean
    isPaymentBanned: boolean
  }
}

interface UserCardProps {
  user:      UserData
  active?:   boolean
  onSelect:  (uid: string) => void
  onUpdated: (uid: string, patch: Partial<UserData>) => void
  onDeleted: (uid: string) => void
}

type ActionKey =
  | 'creator_status'
  | 'user_status'
  | 'admin_status'
  | 'creator_banned_status'
  | 'payment_banned_status'
  | 'delete_user'
  | 'password_reset'

export default function UserCard({ user, active = false, onSelect, onUpdated, onDeleted }: UserCardProps) {
  const [expanded,      setExpanded]      = useState(false)
  const [pending,       setPending]       = useState<ActionKey | null>(null)
  const [resetLink,     setResetLink]     = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [showCompliance, setShowCompliance] = useState(false)

  async function callAction(action: ActionKey, value?: boolean) {
    setPending(action)
    setError(null)
    try {
      const res  = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid: user.uid, action, value }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)

      if (action === 'password_reset') {
        setResetLink(json.resetLink)
      } else if (action === 'delete_user') {
        onDeleted(user.uid)
      } else {
        const patches: Partial<UserData> = {}
        if (action === 'creator_status')        patches.roles        = { ...user.roles,        isCreator:       value! }
        if (action === 'admin_status')           patches.roles        = { ...user.roles,        isAdmin:         value! }
        if (action === 'user_status')            patches.restrictions = { ...user.restrictions, isBanned:        value! }
        if (action === 'creator_banned_status')  patches.restrictions = { ...user.restrictions, isCreatorBanned: value! }
        if (action === 'payment_banned_status')  patches.restrictions = { ...user.restrictions, isPaymentBanned: value! }
        onUpdated(user.uid, patches)
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setPending(null)
      setConfirmDelete(false)
    }
  }

  const isPending = (a: ActionKey) => pending === a

  return (
    <>
      <div
        className={`overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md cursor-pointer ${
          active ? 'border-primary ring-1 ring-primary/30' : 'border-border'
        }`}
        onClick={() => onSelect(user.uid)}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm select-none">
              {user.fullname.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user.fullname}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {/* Mobile compliance button — hidden on lg */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowCompliance(true) }}
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors lg:hidden"
            >
              <FileText size={10} />
              Compliance
            </button>

            {/* Status badges */}
            <div className="flex flex-wrap justify-end gap-1.5">
              {user.roles.isAdmin              && <Badge color="blue"   label="Admin"          />}
              {user.roles.isCreator            && <Badge color="purple" label="Creator"         />}
              {user.restrictions.isBanned       && <Badge color="red"    label="Banned"          />}
              {user.restrictions.isCreatorBanned && <Badge color="orange" label="Creator Banned"  />}
              {user.restrictions.isPaymentBanned && <Badge color="yellow" label="Pay Banned"      />}
            </div>
          </div>
        </div>

        {/* ── Meta row ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Mail     size={11} />{user.email}</span>
          <span className="flex items-center gap-1"><Phone    size={11} />{user.phone}</span>
          <span className="flex items-center gap-1"><Calendar size={11} />
            {new Date(user.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* ── Expandable manage section ── */}
        <div className="border-t border-border" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span>Manage user</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div className="space-y-3 px-4 pb-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle size={13} />
                  {error}
                </div>
              )}

              {resetLink && (
                <PasswordResetLinkBox link={resetLink} onDismiss={() => setResetLink(null)} />
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ToggleRow
                  label="Creator"     icon={<ShieldCheck size={14} />}
                  active={user.roles.isCreator}
                  loading={isPending('creator_status')}
                  onToggle={(v) => callAction('creator_status', v)}
                />
                <ToggleRow
                  label="Admin"       icon={<Shield size={14} />}
                  active={user.roles.isAdmin}
                  loading={isPending('admin_status')}
                  onToggle={(v) => callAction('admin_status', v)}
                />
                <ToggleRow
                  label="Ban User"    icon={<Ban size={14} />}
                  active={user.restrictions.isBanned}
                  loading={isPending('user_status')}
                  onToggle={(v) => callAction('user_status', v)}
                  danger
                />
                <ToggleRow
                  label="Ban Creator" icon={<ShieldOff size={14} />}
                  active={user.restrictions.isCreatorBanned}
                  loading={isPending('creator_banned_status')}
                  onToggle={(v) => callAction('creator_banned_status', v)}
                  danger
                />
                <ToggleRow
                  label="Ban Payments" icon={<Ban size={14} />}
                  active={user.restrictions.isPaymentBanned}
                  loading={isPending('payment_banned_status')}
                  onToggle={(v) => callAction('payment_banned_status', v)}
                  danger
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <ActionButton
                  icon={<KeyRound size={13} />}
                  label="Password Reset"
                  loading={isPending('password_reset')}
                  onClick={() => callAction('password_reset')}
                />

                {!confirmDelete ? (
                  <ActionButton
                    icon={<Trash2 size={13} />}
                    label="Delete Account"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
                    <span className="text-destructive font-medium">Are you sure?</span>
                    <button
                      onClick={() => callAction('delete_user')}
                      disabled={isPending('delete_user')}
                      className="flex items-center gap-1 rounded bg-destructive px-2 py-1 text-destructive-foreground font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending('delete_user') ? <Loader2 size={11} className="animate-spin" /> : null}
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile compliance dialog ── */}
      {showCompliance && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 lg:hidden"
          onClick={() => setShowCompliance(false)}
        >
          <div
            className="max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog handle + header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Compliance — {user.fullname}
              </p>
              <button
                onClick={() => setShowCompliance(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <UserCompliancePanel uid={user.uid} fullname={user.fullname} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  const map: Record<string, string> = {
    blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    red:    'bg-red-500/10 text-red-600 dark:text-red-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    yellow: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  }
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[color]}`}>
      {label}
    </span>
  )
}

function ToggleRow({
  label, icon, active, loading, onToggle, danger = false,
}: {
  label:    string
  icon:     React.ReactNode
  active:   boolean
  loading:  boolean
  onToggle: (v: boolean) => void
  danger?:  boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <span className={`flex items-center gap-1.5 text-xs ${danger ? 'text-destructive/80' : 'text-muted-foreground'}`}>
        {icon} {label}
      </span>
      <button
        disabled={loading}
        onClick={() => onToggle(!active)}
        className={`relative flex h-5 w-9 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
          active
            ? danger ? 'bg-destructive' : 'bg-primary'
            : 'bg-muted'
        }`}
        aria-label={`Toggle ${label}`}
      >
        {loading ? (
          <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />
        ) : (
          <span
            className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
              active ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        )}
      </button>
    </div>
  )
}

function ActionButton({
  icon, label, loading = false, onClick, variant = 'default',
}: {
  icon:     React.ReactNode
  label:    string
  loading?: boolean
  onClick:  () => void
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${
        variant === 'danger'
          ? 'border border-destructive/40 bg-destructive/5 text-destructive'
          : 'border border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}