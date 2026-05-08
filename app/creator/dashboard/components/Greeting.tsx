'use client'

import { useEffect, useState } from 'react'

interface GreetingProps {
  name?: string | null
  username?: string | null
}

function getGreeting(hour: number): { text: string; emoji: string; timeOfDay: string } {
  if (hour < 12) return { text: 'Good morning',   emoji: '☀️',  timeOfDay: 'this morning' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️', timeOfDay: 'this afternoon' }
  if (hour < 21) return { text: 'Good evening',   emoji: '🌆',  timeOfDay: 'this evening' }
  return           { text: 'Good night',          emoji: '🌙',  timeOfDay: 'tonight' }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function Greeting({ name, username }: GreetingProps) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-24" />

  const { text, emoji, timeOfDay } = getGreeting(now.getHours())

  // Prefer username, fall back to first name from displayName, then nothing
  const displayHandle = username
    ? `${username}`
    : name
    ? name.split(' ')[0]
    : null

  const hours   = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())

  const dateStr = now.toLocaleDateString('en-NG', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      {/* Greeting */}
      <div>
        <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase mb-1">
          {emoji} {dateStr}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
          {text}{displayHandle ? `, ${displayHandle}` : ''}!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What are we selling {timeOfDay}? 🛒
        </p>
      </div>

      {/* Live clock */}
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
          {hours}:{minutes}
        </span>
        <span className="text-xl sm:text-2xl font-semibold text-muted-foreground w-8">
          :{seconds}
        </span>
      </div>
    </div>
  )
}