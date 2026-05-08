'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LayoutDashboard } from 'lucide-react'

interface AlreadyCreatorProps {
  username: string
}

export function AlreadyCreator({ username }: AlreadyCreatorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 px-4 text-center">
      <div className="relative w-64 h-64 sm:w-80 sm:h-80">
        <Image
          src="/already-creator.svg"
          alt="Already a creator"
          fill
          className="object-contain"
          priority
        />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold text-foreground">
          You're already a creator!
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Dear <span className="font-semibold text-foreground">{username}</span>, you're already
          a creator on U Mart. Access your dashboard to manage your listings and track your sales.
        </p>
      </div>

      <Button asChild size="lg" className="gap-2 rounded-xl px-8">
        <Link href="/creator/dashboard">
          <LayoutDashboard className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </Button>
    </div>
  )
}