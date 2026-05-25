'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <img
        src="/offline.svg"
        alt="Offline illustration"
        className="w-64 h-auto mb-8 opacity-90"
      />
      <h1 className="text-3xl font-bold text-foreground mb-3">
        You've gone rogue 📡
      </h1>
      <p className="text-muted-foreground max-w-sm text-base mb-2">
        Looks like your internet packed its bags and left without telling you.
      </p>
      <p className="text-muted-foreground max-w-sm text-sm mb-8">
        Don't worry — Umart will be here when you get back online. Your deals aren't going anywhere. Probably.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        Try again 🔄
      </button>
    </div>
  )
}
