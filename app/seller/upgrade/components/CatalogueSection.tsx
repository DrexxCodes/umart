'use client'

import { useRef, useState } from 'react'
import { SectionShell } from './SectionShell'
import { uploadImageToCloudinary } from '@/lib/cloudinary'
import { BookOpen, Camera, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  token: string
  onComplete: (data: { profilePhoto: string | null; coverPhoto: string | null; bio: string }) => void
  complete: boolean
}

function PhotoPicker({
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
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      setUploading(true)
      const res = await uploadImageToCloudinary(file)
      onUploaded(res.secure_url)
    } catch {
      // silently fail — user can retry
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`relative overflow-hidden border-2 border-dashed border-border bg-muted hover:border-primary/50 transition-colors group
          ${shape === 'circle' ? 'w-20 h-20 rounded-full' : 'w-full h-28 rounded-xl'}`}
      >
        {current ? (
          <img src={current} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-1">
            <ImagePlus size={16} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 size={15} className="text-white animate-spin" />
            : <Camera size={15} className="text-white" />}
        </div>
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  )
}

export function CatalogueSection({ token, onComplete, complete }: Props) {
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, profilePhoto, coverPhoto }),
      })
      const result = await res.json()
      if (result.success || result.error === 'Catalogue already exists') {
        onComplete({ profilePhoto, coverPhoto, bio })
      }
    } catch {
      // handled via complete state
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionShell icon={<BookOpen size={14} />} title="Create Your Catalogue" complete={complete}>
      <p className="text-xs text-muted-foreground">
        Set up your public seller profile. Buyers can discover your products and leave reviews here.
      </p>

      {!complete && (
        <div className="space-y-4 pt-1">
          {/* Cover photo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cover Photo</label>
            <PhotoPicker current={coverPhoto} onUploaded={setCoverPhoto} label="Add cover" shape="rect" />
          </div>

          {/* Profile photo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Profile Photo</label>
            <PhotoPicker current={profilePhoto} onUploaded={setProfilePhoto} label="Add photo" shape="circle" />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bio <span className="font-normal text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell buyers about what you sell, your delivery info..."
              rows={2}
              maxLength={400}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>

          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={13} className="animate-spin mr-2" />Saving…</> : 'Create Catalogue'}
          </Button>
        </div>
      )}

      {complete && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Your catalogue has been created. You can customise it further from the Creator dashboard.
        </p>
      )}
    </SectionShell>
  )
}
