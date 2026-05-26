/**
 * Utility functions for handling Firestore timestamps across the application
 */

/**
 * Converts various timestamp formats to a JavaScript Date object
 * Handles Firestore Timestamp objects, Date objects, numbers, and ISO strings
 */
export function convertToDate(timestamp: any): Date {
  if (!timestamp) {
    return new Date()
  }

  // Handle Firestore Timestamp object with 'seconds' property
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date(timestamp.seconds * 1000)
  }

  // Handle JavaScript Date object
  if (timestamp instanceof Date) {
    return timestamp
  }

  // Handle Unix timestamp in milliseconds
  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }

  // Handle ISO string or other string formats
  if (typeof timestamp === 'string') {
    return new Date(timestamp)
  }

  // Fallback
  return new Date()
}

/**
 * Formats a timestamp as a relative time string (e.g., "5m ago", "2h ago")
 */
export function formatRelativeTime(timestamp: any): string {
  if (!timestamp) return ''

  const date = convertToDate(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`
  return `${Math.floor(diffMins / 43200)}w ago`
}

/**
 * Formats a timestamp as a time string (e.g., "2:30 PM")
 */
export function formatTime(timestamp: any): string {
  const date = convertToDate(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats a timestamp as a full date and time string (e.g., "Jan 23, 2:30 PM")
 */
export function formatDateTime(timestamp: any): string {
  const date = convertToDate(timestamp)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Chat date grouping helpers ─────────────────────────────────────────────────

/**
 * Returns the day label for a chat date separator.
 * "Today", "Yesterday", or "DD/MM/YYYY"
 */
export function getChatDayLabel(date: Date): string {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day   = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  const dd   = String(date.getDate()).padStart(2, '0')
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Returns a "YYYY-MM-DD" key for grouping messages by day.
 */
export function getDayKey(date: Date): string {
  const yyyy = date.getFullYear()
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
