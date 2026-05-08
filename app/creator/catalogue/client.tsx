'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { CreatorNav } from '@/components/nav/creator-nav'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { uploadImageToCloudinary } from '@/lib/cloudinary'
import {
  Loader2, Camera, ImagePlus, CheckCircle2, Copy, ExternalLink,
  Pencil, Star,
} from 'lucide-react'
import { toast } from 'sonner'

interface CatalogueData {
  catalogueId: string
  username: string
  bio: string
  profilePhoto: string | null
  coverPhoto: string | null
  reviewsCount: number
  averageReview: number
}

function AvatarUpload({
  current,
  onUploaded,
  label,
  shape = 'circle',
}: {
  current: string | null
  onUploaded: (url: string) => void
  label: string
  shape?: 'circle' | 'rect'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      setUploading(true)
      const res = await uploadImageToCloudinary(file)
      onUploaded(res.secure_url)
    } catch {
      toast.error('Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative overflow-hidden border-2 border-dashed border-border bg-muted hover:border-primary/50 transition-colors group
          ${shape === 'circle' ? 'w-24 h-24 rounded-full' : 'w-full h-32 rounded-xl'}`}
      >
        {current ? (
          <img src={current} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-1">
            <ImagePlus size={20} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 size={18} className="text-white animate-spin" />
            : <Camera size={18} className="text-white" />}
        </div>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export function CreatorCatalogueClient() {
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [hasCatalogue, setHasCatalogue] = useState<boolean | null>(null)
  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  // Form state
  const [bio, setBio] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid)
      else router.push('/auth/login')
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!uid) return
    ;(async () => {
      try {
        setLoading(true)
        const token = await auth.currentUser!.getIdToken()
        const res = await fetch(`/api/catalogue?userId=${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await res.json()
        if (result.success && result.data) {
          setHasCatalogue(true)
          setCatalogue(result.data)
          setBio(result.data.bio ?? '')
          setProfilePhoto(result.data.profilePhoto)
          setCoverPhoto(result.data.coverPhoto)
        } else {
          setHasCatalogue(false)
        }
      } catch {
        setHasCatalogue(false)
      } finally {
        setLoading(false)
      }
    })()
  }, [uid])

  const handleCreate = async () => {
    try {
      setCreating(true)
      const token = await auth.currentUser!.getIdToken()
      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, profilePhoto, coverPhoto }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      // Refetch
      const res2 = await fetch(`/api/catalogue?userId=${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result2 = await res2.json()
      setCatalogue(result2.data)
      setHasCatalogue(true)
      toast.success('Catalogue created!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create catalogue')
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const token = await auth.currentUser!.getIdToken()
      const res = await fetch('/api/catalogue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, profilePhoto, coverPhoto }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      setCatalogue((prev) => prev ? { ...prev, bio, profilePhoto, coverPhoto } : null)
      setEditMode(false)
      toast.success('Catalogue updated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const shareLink = catalogue
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/seller/${catalogue.catalogueId}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    toast.success('Link copied!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // ── No catalogue yet ─────────────────────────────────────────────────────
  if (!hasCatalogue) {
    return (
      <div className="min-h-screen bg-background">
        <CreatorNav />
        <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center gap-6">
          <img src="/NewCatalogue.svg" alt="Create catalogue" className="w-52 h-52 object-contain" />
          <div>
            <h1 className="text-2xl font-bold mb-2">Create your Umart catalogue</h1>
            <p className="text-muted-foreground text-sm">
              Share your catalogue with friends and customers so they can browse your products and leave reviews.
            </p>
          </div>

          <Card className="w-full p-6 space-y-5 text-left">
            {/* Cover photo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cover Photo</label>
              <AvatarUpload current={coverPhoto} onUploaded={setCoverPhoto} label="Add cover" shape="rect" />
            </div>

            {/* Profile photo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile Photo</label>
              <AvatarUpload current={profilePhoto} onUploaded={setProfilePhoto} label="Add photo" shape="circle" />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bio <span className="font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell customers about yourself, what you sell, delivery info..."
                rows={3}
                maxLength={400}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 size={14} className="animate-spin mr-2" />Creating…</> : 'Create Catalogue'}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // ── Existing catalogue ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <CreatorNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Catalogue</h1>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode((e) => !e)}>
            <Pencil size={13} />
            {editMode ? 'Cancel' : 'Edit'}
          </Button>
        </div>

        {/* Preview card */}
        <Card className="overflow-hidden">
          {/* Cover */}
          <div className="relative h-36 bg-muted">
            {(editMode ? coverPhoto : catalogue?.coverPhoto) ? (
              <img src={editMode ? coverPhoto! : catalogue!.coverPhoto!} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
            )}
            {editMode && (
              <div className="absolute inset-0 flex items-center justify-center">
                <AvatarUpload current={coverPhoto} onUploaded={setCoverPhoto} label="Cover" shape="rect" />
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            {/* Profile photo */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="relative">
                {editMode ? (
                  <AvatarUpload current={profilePhoto} onUploaded={setProfilePhoto} label="Photo" shape="circle" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-4 border-card overflow-hidden bg-muted">
                    {catalogue?.profilePhoto ? (
                      <img src={catalogue.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                        {catalogue?.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stars */}
              {(catalogue?.reviewsCount ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-sm font-semibold">{catalogue!.averageReview.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({catalogue!.reviewsCount} reviews)</span>
                </div>
              )}
            </div>

            <h2 className="text-lg font-bold">{catalogue?.username}</h2>

            {editMode ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell customers about yourself..."
                rows={3}
                maxLength={400}
                className="mt-2 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              />
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {catalogue?.bio || <span className="italic">No bio yet</span>}
              </p>
            )}
          </div>
        </Card>

        {editMode && (
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin mr-2" />Saving…</> : <><CheckCircle2 size={14} className="mr-2" />Save Changes</>}
          </Button>
        )}

        {/* Share link */}
        <Card className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Catalogue Link</p>
          <div className="flex gap-2">
            <Input readOnly value={shareLink} className="font-mono text-xs bg-muted/50" />
            <Button variant="outline" size="icon" onClick={copyLink}><Copy size={14} /></Button>
            <Button variant="outline" size="icon" onClick={() => window.open(shareLink, '_blank')}>
              <ExternalLink size={14} />
            </Button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5 text-center">
            <p className="text-3xl font-bold text-primary">{catalogue?.reviewsCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Reviews</p>
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Star size={18} className="text-amber-400 fill-amber-400" />
              <p className="text-3xl font-bold">{catalogue?.averageReview?.toFixed(1) ?? '—'}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average Rating</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
