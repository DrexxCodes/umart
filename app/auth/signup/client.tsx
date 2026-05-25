'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { signupResponse } from '@/lib/auth-response'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle2, Gift, BadgeCheck } from 'lucide-react'

export default function SignupClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') || '/'
  const urlRef       = searchParams.get('ref') || ''

  // ── Form state ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    username: '',
    fullname: '',
    email:    '',
    password: '',
    phone:    '',
    refCode:  urlRef,   // pre-filled from URL ?ref=
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [loading,      setLoading]      = useState(false)

  // ── Referral verification state ───────────────────────────────────────────
  const [campaignLabel, setCampaignLabel]     = useState<string | null>(null)
  const [verifyingRef,  setVerifyingRef]      = useState(false)
  const refDebounceRef                        = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auto-verify referral from URL after 5 s if no user input ─────────────
  useEffect(() => {
    if (!urlRef) return
    const t = setTimeout(() => {
      if (!formData.refCode || formData.refCode === urlRef) {
        verifyReferral(urlRef)
      }
    }, 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRef])

  // ── Debounced verify on manual input ─────────────────────────────────────
  const handleRefCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormData((p) => ({ ...p, refCode: val }))
    setCampaignLabel(null)

    if (refDebounceRef.current) clearTimeout(refDebounceRef.current)
    if (!val.trim()) return

    refDebounceRef.current = setTimeout(() => {
      verifyReferral(val.trim())
    }, 800)
  }

  async function verifyReferral(code: string) {
    setVerifyingRef(true)
    try {
      const res = await fetch(`/api/referrals?code=${encodeURIComponent(code)}`)
      if (res.ok) {
        const json = await res.json()
        setCampaignLabel(json.campaignName ?? null)
      } else {
        setCampaignLabel(null)
      }
    } catch {
      setCampaignLabel(null)
    } finally {
      setVerifyingRef(false)
    }
  }

  // ── General form change ───────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // 1. Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      )
      const newUid = userCredential.user.uid

      // 2. Create Firestore user profile
      const profileRes = await fetch('/api/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid:      newUid,
          username: formData.username,
          fullname: formData.fullname,
          email:    formData.email,
          phone:    formData.phone,
        }),
      })

      if (!profileRes.ok) {
        const errorData = await profileRes.json()
        throw new Error(errorData.message || 'Failed to create user profile')
      }

      const userData = await profileRes.json()

      // 3. Set auth cookies
      const idToken       = await userCredential.user.getIdToken()
      const cookieRes     = await fetch('/api/users/cookies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token:        idToken,
          roles:        userData.data?.roles        || { isCreator: false, isAdmin: false },
          restrictions: userData.data?.restrictions || {
            isBanned: false, isCreatorBanned: false, isPaymentBanned: false,
          },
        }),
      })

      if (!cookieRes.ok) throw new Error('Failed to set authentication cookies')

      // 4. Track referral signup if a valid code was entered
      const code = formData.refCode.trim()
      if (code && campaignLabel) {
        // Fire-and-forget — don't block signup on this
        fetch('/api/referrals?action=track', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refrId:   code,
            userId:   newUid,
            fullname: formData.fullname,
            email:    formData.email,
          }),
        }).catch(() => { /* non-critical */ })
      }

      const result = signupResponse(null, redirect)
      setSuccess(result.message)

      const redirectPath = redirect.startsWith('/') ? redirect : `/${redirect}`
      setTimeout(() => { window.location.href = redirectPath }, 1000)
    } catch (err: any) {
      const result = signupResponse(err)
      setError(result.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md sm:max-w-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded bg-primary flex items-center justify-center">
              <span className="font-bold text-primary-foreground">UH</span>
            </div>
            <span className="text-xl font-bold">uHomes Mart</span>
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Fill in your details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div className="flex gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            {error && (
              <div className="flex gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">Username</label>
                <Input
                  id="username" name="username" placeholder="johndoe"
                  value={formData.username} onChange={handleChange}
                  disabled={loading} required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="fullname" className="text-sm font-medium">Full Name</label>
                <Input
                  id="fullname" name="fullname" placeholder="John Doe"
                  value={formData.fullname} onChange={handleChange}
                  disabled={loading} required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email" name="email" type="email" placeholder="you@example.com"
                value={formData.email} onChange={handleChange}
                disabled={loading} required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone Number</label>
              <Input
                id="phone" name="phone" type="tel" placeholder="+234 123 456 7890"
                value={formData.phone} onChange={handleChange}
                disabled={loading} required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password} onChange={handleChange}
                  disabled={loading} required className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ── Referral code field ──────────────────────────────────────── */}
            <div className="space-y-2">
              <label htmlFor="refCode" className="text-sm font-medium flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-primary" />
                Referral Code
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  id="refCode"
                  name="refCode"
                  placeholder="Enter referral code"
                  value={formData.refCode}
                  onChange={handleRefCodeChange}
                  disabled={loading}
                  className={`font-mono tracking-wider pr-8 ${
                    campaignLabel ? 'border-green-400 focus-visible:ring-green-400/30' : ''
                  }`}
                />
                {verifyingRef && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
                {!verifyingRef && campaignLabel && (
                  <BadgeCheck className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>

              {/* Campaign attribution badge */}
              {campaignLabel && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  <strong>{campaignLabel}</strong> referred you!
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
              className="font-medium text-primary hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
