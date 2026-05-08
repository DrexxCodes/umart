'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Camera, Eye, Hand, CheckCircle2,
  Loader2, AlertCircle, Lock, ShieldCheck, RefreshCw,
} from 'lucide-react'
import { uploadImageToCloudinary } from '@/lib/cloudinary'
import { SectionShell } from './SectionShell'
import { LandmarkDrawer, DrawData } from './LandmarkDrawer'

interface PassportSectionProps {
  token:      string
  initial?:   any
  onComplete: (done: boolean) => void
}

type Stage =
  | 'idle'
  | 'face'
  | 'face_captured'
  | 'hand'
  | 'hand_captured'
  | 'done'

// ─── MediaPipe loaders ────────────────────────────────────────────────────────
async function buildFaceLandmarker() {
  const vision = await import('@mediapipe/tasks-vision')
  const { FaceLandmarker, FilesetResolver } = vision
  const resolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )
  return FaceLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'CPU',
    },
    runningMode:           'VIDEO',
    numFaces:              6,  // detect up to 6 so we can warn about extras
    outputFaceBlendshapes: true,
  })
}

async function buildHandLandmarker() {
  const vision = await import('@mediapipe/tasks-vision')
  const { HandLandmarker, FilesetResolver } = vision
  const resolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )
  return HandLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numHands:    2,  // detect up to 2 so we can warn when both hands appear
  })
}

// ─── Landmark helpers ─────────────────────────────────────────────────────────
type LM = { x: number; y: number; z: number }

/**
 * Relaxed thumb-only detection.
 *   1. Thumb tip (4) extended from MCP (2) — dist > 0.08 (was 0.10)
 *   2. At least 3 of 4 fingers curled — tolerates natural pinky splay
 *   3. Thumb tip above wrist (landmark 0) — replaced stricter index-MCP check
 */
function isThumbOnlyExtended(lm: LM[]): boolean {
  const thumbTip = lm[4]
  const thumbMcp = lm[2]
  const dx = thumbTip.x - thumbMcp.x
  const dy = thumbTip.y - thumbMcp.y
  if (Math.sqrt(dx * dx + dy * dy) < 0.08) return false

  const fingerPairs: [number, number][] = [
    [8,  6],
    [12, 10],
    [16, 14],
    [20, 18],
  ]
  const curledCount = fingerPairs.filter(([tip, pip]) => lm[tip].y > lm[pip].y).length
  if (curledCount < 3) return false

  if (thumbTip.y >= lm[0].y) return false

  return true
}

/**
 * Gaze check — two conditions must both pass:
 *   1. Head yaw: nose tip (1) is within 14% of frame width of the eye midpoint (133/362)
 *   2. Eyeball direction: each iris centre (468 left, 473 right) must sit near the
 *      geometric centre of its eye contour corners. We use the inner (133/362) and
 *      outer (33/263) eye corners. If the iris drifts more than 30% of the eye width
 *      away from eye centre, the user is looking sideways.
 *      Falls back gracefully to head-yaw only when iris landmarks are absent (<478 pts).
 */
function isLookingAtCamera(lm: LM[]): boolean {
  // Head yaw check
  const noseTip    = lm[1]
  const leftInner  = lm[133]
  const rightInner = lm[362]
  const eyeMidX    = (leftInner.x + rightInner.x) / 2
  if (Math.abs(noseTip.x - eyeMidX) >= 0.14) return false

  // Eyeball check — only run when iris landmarks present (index 468+)
  if (lm.length >= 478 && lm[468] && lm[473]) {
    // Left eye: inner corner 133, outer corner 33, iris centre 468
    const leftEyeWidth  = Math.abs(lm[33].x  - lm[133].x)
    const leftEyeCentreX = (lm[33].x + lm[133].x) / 2
    const leftIrisDrift  = Math.abs(lm[468].x - leftEyeCentreX)
    if (leftEyeWidth > 0.001 && leftIrisDrift / leftEyeWidth > 0.30) return false

    // Right eye: inner corner 362, outer corner 263, iris centre 473
    const rightEyeWidth   = Math.abs(lm[263].x - lm[362].x)
    const rightEyeCentreX = (lm[263].x + lm[362].x) / 2
    const rightIrisDrift  = Math.abs(lm[473].x - rightEyeCentreX)
    if (rightEyeWidth > 0.001 && rightIrisDrift / rightEyeWidth > 0.30) return false
  }

  return true
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PassportSection({ token, initial, onComplete }: PassportSectionProps) {
  const alreadyDone = Boolean(initial?.faceImageUrl) && Boolean(initial?.faceWithHandImageUrl)

  const [stage,         setStage]         = useState<Stage>(alreadyDone ? 'done' : 'idle')
  const [faceBlob,      setFaceBlob]      = useState<Blob | null>(null)
  const [handBlob,      setHandBlob]      = useState<Blob | null>(null)
  const [facePreview,   setFacePreview]   = useState(initial?.faceImageUrl         ?? '')
  const [handPreview,   setHandPreview]   = useState(initial?.faceWithHandImageUrl ?? '')
  const [blinkCount,    setBlinkCount]    = useState(0)
  const [thumbDetected, setThumbDetected] = useState(false)
  const [statusMsg,     setStatusMsg]     = useState('')
  const [modelLoading,  setModelLoading]  = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [countdown,     setCountdown]     = useState<number | null>(null)
  const [drawData,      setDrawData]      = useState<DrawData>(null)
  const [videoSize,     setVideoSize]     = useState({ w: 640, h: 480 })

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number>(0)
  const faceLMRef     = useRef<any>(null)
  const handLMRef     = useRef<any>(null)
  const blinkRef      = useRef({ wasOpen: true, count: 0 })
  const captureRef    = useRef(false)
  const countdownRef  = useRef<number | null>(null)

  const isDone = stage === 'done'
  useEffect(() => { onComplete(isDone) }, [isDone, onComplete])
  useEffect(() => () => { killStream() }, [])

  function onVideoMeta() {
    const v = videoRef.current
    if (v) setVideoSize({ w: v.videoWidth || 640, h: v.videoHeight || 480 })
  }

  // ── Camera ───────────────────────────────────────────────────────────────────
  async function startCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    })
    streamRef.current = stream
    const v = videoRef.current
    if (!v) throw new Error('Video element not ready')
    v.srcObject = stream
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => v.play().then(resolve).catch(reject)
      v.onerror = reject
    })
    setVideoSize({ w: v.videoWidth || 640, h: v.videoHeight || 480 })
  }

  function killStream() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setDrawData(null)
  }

  function captureToBlob(cb: (b: Blob) => void) {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c) return
    c.width  = v.videoWidth  || 640
    c.height = v.videoHeight || 480
    const ctx = c.getContext('2d')!
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(v, -c.width, 0)
    ctx.restore()
    c.toBlob((b) => { if (b) cb(b) }, 'image/jpeg', 0.92)
  }

  // ── Face detection loop ───────────────────────────────────────────────────────
  const runFaceLoop = useCallback(() => {
    const v = videoRef.current
    if (!v || !faceLMRef.current) { rafRef.current = requestAnimationFrame(runFaceLoop); return }
    if (v.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || v.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(runFaceLoop); return
    }

    let result: any
    try { result = faceLMRef.current.detectForVideo(v, performance.now()) }
    catch { rafRef.current = requestAnimationFrame(runFaceLoop); return }

    const faceCount  = result?.faceLandmarks?.length ?? 0
    const hasFace    = faceCount > 0
    const allFaceLM  = (result?.faceLandmarks ?? []) as LM[][]
    const lm         = allFaceLM[0] as LM[] | undefined
    const cats       = result?.faceBlendshapes?.[0]?.categories ?? []
    const lScore     = cats.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score  ?? 0
    const rScore     = cats.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score ?? 0
    const eyesClosed = (lScore + rScore) / 2 > 0.45
    const lookingAt  = hasFace && lm ? isLookingAtCamera(lm) : false

    const bs = blinkRef.current

    if (!hasFace) {
      // Face left frame — wipe blink progress entirely
      if (bs.count > 0 || !bs.wasOpen) {
        bs.wasOpen = true
        bs.count   = 0
        setBlinkCount(0)
        countdownRef.current = null
        setCountdown(null)
      }
      setDrawData(null)
      setStatusMsg('No face detected — look straight at the camera')
      rafRef.current = requestAnimationFrame(runFaceLoop)
      return
    }

    // More than one face — block and warn
    if (faceCount > 1) {
      countdownRef.current = null
      setCountdown(null)
      setDrawData({ mode: 'face', landmarks: lm!, allLandmarks: allFaceLM, isValid: false })
      setStatusMsg('More than one face detected — please be alone in the frame')
      rafRef.current = requestAnimationFrame(runFaceLoop)
      return
    }

    // Face is present — update drawer
    const readyToCapture = lookingAt && bs.count >= 2
    setDrawData({ mode: 'face', landmarks: lm!, allLandmarks: allFaceLM, isValid: readyToCapture })

    if (lookingAt) {
      if (eyesClosed && bs.wasOpen) {
        bs.wasOpen = false
      } else if (!eyesClosed && !bs.wasOpen) {
        bs.wasOpen = true
        bs.count  += 1
        setBlinkCount(bs.count)
        setStatusMsg(`Blink ${bs.count} detected`)
      }
    } else {
      // Looked away — reset blinks so they must redo from scratch
      if (bs.count > 0 || !bs.wasOpen) {
        bs.wasOpen = true
        bs.count   = 0
        setBlinkCount(0)
        countdownRef.current = null
        setCountdown(null)
      }
    }

    // ── Countdown / capture ───────────────────────────────────────────────────
    if (readyToCapture && !captureRef.current) {
      const now = performance.now()
      if (countdownRef.current === null) countdownRef.current = now
      const elapsed   = now - countdownRef.current
      const remaining = Math.ceil((3000 - elapsed) / 1000)
      setCountdown(remaining > 0 ? remaining : null)

      if (elapsed >= 3000) {
        captureRef.current = true
        setCountdown(null)
        setDrawData(null)
        cancelAnimationFrame(rafRef.current)
        captureToBlob((blob) => {
          setFaceBlob(blob)
          setFacePreview(URL.createObjectURL(blob))
          killStream()
          setStage('face_captured')
          setStatusMsg('')
        })
        return
      }
      setStatusMsg(`Hold still... capturing in ${remaining}s`)
    } else if (!readyToCapture) {
      if (countdownRef.current !== null) {
        countdownRef.current = null
        setCountdown(null)
      }
      if (!lookingAt) {
        setStatusMsg('Eyes not facing the camera — look straight ahead')
      } else {
        const left = 2 - bs.count
        setStatusMsg(`Blink slowly ${left} more time${left === 1 ? '' : 's'}`)
      }
    }

    rafRef.current = requestAnimationFrame(runFaceLoop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hand detection loop ───────────────────────────────────────────────────────
  const runHandLoop = useCallback(() => {
    const v = videoRef.current
    if (!v || !handLMRef.current) { rafRef.current = requestAnimationFrame(runHandLoop); return }
    if (v.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || v.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(runHandLoop); return
    }

    let result: any
    try { result = handLMRef.current.detectForVideo(v, performance.now()) }
    catch { rafRef.current = requestAnimationFrame(runHandLoop); return }

    const allHandLM  = (result?.landmarks ?? []) as LM[][]
    const handCount  = allHandLM.length
    const lm         = allHandLM[0] as LM[] | undefined
    const thumbOk    = lm ? isThumbOnlyExtended(lm) : false

    setThumbDetected(thumbOk)
    setDrawData(lm ? { mode: 'hand', landmarks: lm, allLandmarks: allHandLM, isValid: thumbOk } : null)

    // Two hands visible — warn and block countdown
    if (handCount > 1) {
      if (countdownRef.current !== null) { countdownRef.current = null; setCountdown(null) }
      setStatusMsg('Put one hand down — show only your thumb')
      rafRef.current = requestAnimationFrame(runHandLoop)
      return
    }

    if (thumbOk && !captureRef.current) {
      const now = performance.now()
      if (countdownRef.current === null) countdownRef.current = now
      const elapsed   = now - countdownRef.current
      const remaining = Math.ceil((3000 - elapsed) / 1000)
      setCountdown(remaining > 0 ? remaining : null)

      if (elapsed >= 3000) {
        captureRef.current = true
        setCountdown(null)
        setDrawData(null)
        cancelAnimationFrame(rafRef.current)
        captureToBlob((blob) => {
          setHandBlob(blob)
          setHandPreview(URL.createObjectURL(blob))
          killStream()
          setStage('hand_captured')
          setStatusMsg('')
        })
        return
      }
      setStatusMsg(`Thumb detected — hold still... capturing in ${remaining}s`)
    } else {
      if (!thumbOk && countdownRef.current !== null) {
        countdownRef.current = null
        setCountdown(null)
      }
      setStatusMsg(lm
        ? 'Curl your fingers and point your thumb up'
        : 'No hand detected — hold your thumb up clearly'
      )
    }

    rafRef.current = requestAnimationFrame(runHandLoop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────────
  async function handleStartFace() {
    setError(null)
    setModelLoading(true)
    captureRef.current   = false
    countdownRef.current = null
    setCountdown(null)
    setDrawData(null)
    blinkRef.current     = { wasOpen: true, count: 0 }
    setBlinkCount(0)
    setStatusMsg('Loading face detection model...')
    setStage('face')
    try {
      if (!faceLMRef.current) faceLMRef.current = await buildFaceLandmarker()
      await startCamera()
      setStatusMsg('Look at the camera — blink slowly twice')
      rafRef.current = requestAnimationFrame(runFaceLoop)
    } catch (err: any) {
      setError(err.message ?? 'Failed to open camera or load model')
      setStage('idle')
    } finally {
      setModelLoading(false)
    }
  }

  async function handleStartHand() {
    setError(null)
    setModelLoading(true)
    captureRef.current   = false
    countdownRef.current = null
    setCountdown(null)
    setDrawData(null)
    setThumbDetected(false)
    setStatusMsg('Loading hand detection model...')
    setStage('hand')
    try {
      if (!handLMRef.current) handLMRef.current = await buildHandLandmarker()
      await startCamera()
      setStatusMsg('Curl your fingers and point your thumb up')
      rafRef.current = requestAnimationFrame(runHandLoop)
    } catch (err: any) {
      setError(err.message ?? 'Failed to open camera or load model')
      setStage('face_captured')
    } finally {
      setModelLoading(false)
    }
  }

  function handleRetakeFace() {
    killStream()
    captureRef.current   = false
    countdownRef.current = null
    blinkRef.current     = { wasOpen: true, count: 0 }
    setBlinkCount(0)
    setCountdown(null)
    setDrawData(null)
    setFaceBlob(null)
    setFacePreview('')
    setStatusMsg('')
    setError(null)
    setStage('face')
    setTimeout(async () => {
      try {
        if (!faceLMRef.current) faceLMRef.current = await buildFaceLandmarker()
        await startCamera()
        setStatusMsg('Look at the camera — blink slowly twice')
        rafRef.current = requestAnimationFrame(runFaceLoop)
      } catch (err: any) {
        setError(err.message ?? 'Failed to open camera')
        setStage('hand_captured')
      }
    }, 50)
  }

  function handleRetakeHand() {
    killStream()
    captureRef.current   = false
    countdownRef.current = null
    setThumbDetected(false)
    setCountdown(null)
    setDrawData(null)
    setHandBlob(null)
    setHandPreview('')
    setStatusMsg('')
    setError(null)
    setStage('hand')
    setTimeout(async () => {
      try {
        if (!handLMRef.current) handLMRef.current = await buildHandLandmarker()
        await startCamera()
        setStatusMsg('Curl your fingers and point your thumb up')
        rafRef.current = requestAnimationFrame(runHandLoop)
      } catch (err: any) {
        setError(err.message ?? 'Failed to open camera')
        setStage('hand_captured')
      }
    }, 50)
  }

  function handleRetakeAll() {
    killStream()
    captureRef.current   = false
    countdownRef.current = null
    blinkRef.current     = { wasOpen: true, count: 0 }
    setStage('idle')
    setFaceBlob(null);    setHandBlob(null)
    setFacePreview('');   setHandPreview('')
    setBlinkCount(0);     setThumbDetected(false)
    setCountdown(null);   setDrawData(null)
    setStatusMsg('');     setError(null)
  }

  async function handleUpload() {
    if (!faceBlob || !handBlob) return
    setSaving(true)
    setError(null)
    try {
      const [faceRes, handRes] = await Promise.all([
        uploadImageToCloudinary(new File([faceBlob], 'face.jpg',      { type: 'image/jpeg' })),
        uploadImageToCloudinary(new File([handBlob], 'face-hand.jpg', { type: 'image/jpeg' })),
      ])
      const res = await fetch('/api/users/compliance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          section:                   'passport',
          faceImageUrl:              faceRes.secure_url,
          faceImagePublicId:         faceRes.public_id,
          faceWithHandImageUrl:      handRes.secure_url,
          faceWithHandImagePublicId: handRes.public_id,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Save failed')
      setStage('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const cameraActive = stage === 'face' || stage === 'hand'

  return (
    <SectionShell icon={<Camera size={16} />} title="Live Passport Capture" complete={isDone}>

      {/* Privacy notice */}
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
        <Lock size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Your privacy is protected.</span>{' '}
          These photos will <span className="font-semibold">never appear publicly</span> on U Mart.
          Encrypted and used solely for identity verification.
        </p>
      </div>

      {/* Hidden capture canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera view */}
      <div className={cameraActive ? 'space-y-3' : 'hidden'}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={onVideoMeta}
            className="w-full scale-x-[-1]"
          />

          {/* Landmark overlay */}
          <LandmarkDrawer
            data={drawData}
            width={videoSize.w}
            height={videoSize.h}
            mirrored={true}
          />

          {/* Fallback oval guide when no face data yet */}
          {stage === 'face' && !drawData && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-52 w-40 rounded-full border-2 border-dashed border-primary opacity-60" />
            </div>
          )}

          {/* Fallback hand guide when no hand data yet */}
          {stage === 'hand' && !drawData && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-36 rounded-2xl border-2 border-dashed border-amber-400 opacity-60" />
            </div>
          )}

          {/* Blink progress badge */}
          {stage === 'face' && blinkCount > 0 && (
            <div className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
              {blinkCount} / 2 blinks
            </div>
          )}

          {/* Thumb detected badge */}
          {stage === 'hand' && thumbDetected && (
            <div className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white">
              Thumb detected
            </div>
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
              <span className="text-6xl font-black text-white drop-shadow-lg leading-none">{countdown}</span>
              <p className="text-xs font-semibold text-white/80">Hold still...</p>
            </div>
          )}

          {/* Model loading overlay */}
          {modelLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              <Loader2 size={28} className="animate-spin text-white" />
              <p className="text-xs font-medium text-white">{statusMsg}</p>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
          {stage === 'face'
            ? <Eye  size={13} className="shrink-0 animate-pulse text-primary" />
            : <Hand size={13} className={`shrink-0 ${thumbDetected ? 'text-emerald-500' : 'animate-pulse text-amber-500'}`} />}
          <p className="text-xs font-medium text-foreground">{statusMsg}</p>
        </div>
      </div>

      {/* ── DONE ── */}
      {isDone && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Face capture', src: facePreview || initial?.faceImageUrl },
            { label: 'Face + Hand',  src: handPreview || initial?.faceWithHandImageUrl },
          ].map(({ label, src }) => (
            <div key={label} className="overflow-hidden rounded-xl border border-border">
              {src && <img src={src} alt={label} className="h-32 w-full object-cover" />}
              <p className="border-t border-border bg-muted/40 px-2 py-1 text-center text-[10px] text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <button
          onClick={handleStartFace}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <Camera size={18} />
          Open Secure Camera
        </button>
      )}

      {/* ── FACE CAPTURED ── */}
      {stage === 'face_captured' && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-emerald-500/30">
            <img src={facePreview} alt="Face captured" className="h-36 w-full object-cover" />
            <div className="flex items-center justify-between border-t border-border bg-emerald-500/5 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Face captured!</p>
              </div>
              <button
                onClick={handleStartFace}
                className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={10} />
                Retake
              </button>
            </div>
          </div>
          <button
            onClick={handleStartHand}
            disabled={modelLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            {modelLoading ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />}
            {modelLoading ? 'Loading model...' : 'Now show your thumb'}
          </button>
          {error && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={12} />{error}
            </p>
          )}
        </div>
      )}

      {/* ── HAND CAPTURED ── */}
      {stage === 'hand_captured' && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border">
            <img src={facePreview} alt="Face" className="h-28 w-full object-cover" />
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5">
              <p className="text-[10px] text-muted-foreground">Face</p>
              <button
                onClick={handleRetakeFace}
                disabled={saving}
                className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw size={10} />
                Retake face
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <img src={handPreview} alt="Face + Hand" className="h-28 w-full object-cover" />
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5">
              <p className="text-[10px] text-muted-foreground">Face + Thumb</p>
              <button
                onClick={handleRetakeHand}
                disabled={saving}
                className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <RefreshCw size={10} />
                Retake thumb
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={12} />{error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRetakeAll}
              disabled={saving}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Start Over
            </button>
            <button
              onClick={handleUpload}
              disabled={saving}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Uploading...' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      )}

      {/* Global error (idle) */}
      {error && stage === 'idle' && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={12} />{error}
        </p>
      )}

      {/* Branding */}
      <p className="text-center text-[10px] text-muted-foreground/50">
        <ShieldCheck size={10} className="inline mr-1" />
        Developed by <span className="font-semibold">Drexx T3ch</span> · Encrypted and secure
      </p>
    </SectionShell>
  )
}