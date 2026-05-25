import { Metadata } from 'next'
import { BuyerNav } from '@/components/nav/buyer-nav'
import { ReferralsClient } from './client'

export const metadata: Metadata = {
  title: 'Referrals – U Mart',
  description: 'Generate and track your U Mart referral code',
}

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-background">
      <BuyerNav />
      <ReferralsClient />
    </div>
  )
}
