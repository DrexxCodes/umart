'use client'

import { useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
export type LM = { x: number; y: number; z: number }

export interface FaceDrawData {
  mode:         'face'
  landmarks:    LM[]     // primary face (478-point)
  allLandmarks: LM[][]   // ALL detected faces — extras are always drawn red
  isValid:      boolean  // green when looking at camera + blinks done
}

export interface HandDrawData {
  mode:         'hand'
  landmarks:    LM[]     // primary hand (21-point)
  allLandmarks: LM[][]   // ALL detected hands — extras flagged
  isValid:      boolean  // green when thumb-up + fingers curled
}

export type DrawData = FaceDrawData | HandDrawData | null

interface LandmarkDrawerProps {
  data:      DrawData
  width:     number
  height:    number
  mirrored?: boolean
}

// ─── Face landmark index groups ───────────────────────────────────────────────

// Eyes (closed loops)
const LEFT_EYE  = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33]
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362]

// Eyebrows
const LEFT_BROW  = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
const RIGHT_BROW = [336, 296, 334, 293, 300, 276, 283, 282, 295, 285]

// Nose
const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2]

// Lips
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61]
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78]

// Left ear (tragus → helix arc → lobe) — MediaPipe face mesh indices
// These trace the outer ear shape on the subject's LEFT ear
const LEFT_EAR  = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152]
// Subject's RIGHT ear
const RIGHT_EAR = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152]

// Iris landmarks — indices 468-477 (only present when FaceLandmarker outputs iris)
// Left iris: 468 = centre, 469 right edge, 470 top, 471 left edge, 472 bottom
// Right iris: 473 = centre, 474 right edge, 475 top, 476 left edge, 477 bottom
const LEFT_IRIS_RING  = [469, 470, 471, 472, 469] // closed loop around iris
const RIGHT_IRIS_RING = [474, 475, 476, 477, 474]

// ─── Hand connections ─────────────────────────────────────────────────────────
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13],[13,14], [14,15], [15,16],
  [0, 17],[17,18], [18,19], [19,20],
  [5, 9], [9, 13], [13, 17],
]
const THUMB_INDICES = new Set([1, 2, 3, 4])

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function project(lm: LM, w: number, h: number, mirrored: boolean) {
  const x = mirrored ? (1 - lm.x) * w : lm.x * w
  const y = lm.y * h
  return { x, y }
}

function drawPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], close = false) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  if (close) ctx.closePath()
  ctx.stroke()
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

// Draw a single face mesh with given colours
function drawFaceMesh(
  ctx:      CanvasRenderingContext2D,
  lm:       LM[],
  w:        number,
  h:        number,
  mirrored: boolean,
  primary:  string,
  secondary:string,
  dot:      string,
) {
  const proj = (idx: number) => project(lm[idx], w, h, mirrored)

  const contour = (indices: number[], close = false, color = primary, lw = 1.5) => {
    // Guard: skip if any index is out of bounds
    if (indices.some(i => !lm[i])) return
    ctx.strokeStyle = color
    ctx.lineWidth   = lw
    drawPath(ctx, indices.map(proj), close)
  }

  // Eyes
  contour(LEFT_EYE,  true, primary, 2)
  contour(RIGHT_EYE, true, primary, 2)

  // Iris rings — drawn only if landmarks 468+ exist
  if (lm[469]) {
    ctx.strokeStyle = dot
    ctx.lineWidth   = 1.5
    drawPath(ctx, LEFT_IRIS_RING.map(proj), true)
  }
  if (lm[474]) {
    ctx.strokeStyle = dot
    ctx.lineWidth   = 1.5
    drawPath(ctx, RIGHT_IRIS_RING.map(proj), true)
  }
  // Iris centre dots
  ctx.fillStyle = dot
  if (lm[468]) { const p = proj(468); drawDot(ctx, p.x, p.y, 3.5) }
  if (lm[473]) { const p = proj(473); drawDot(ctx, p.x, p.y, 3.5) }

  // Eyebrows
  contour(LEFT_BROW,  false, secondary, 1.5)
  contour(RIGHT_BROW, false, secondary, 1.5)

  // Nose
  contour(NOSE, false, secondary, 1.5)

  // Lips
  contour(LIPS_OUTER, true, primary,   2)
  contour(LIPS_INNER, true, secondary, 1.2)

  // Ears — open path, subtler weight
  contour(LEFT_EAR,  false, secondary, 1.2)
  contour(RIGHT_EAR, false, secondary, 1.2)

  // Dots on key points
  ctx.fillStyle = dot
  ;[...LEFT_EYE, ...RIGHT_EYE, ...NOSE, ...LIPS_OUTER, ...LEFT_EAR, ...RIGHT_EAR].forEach(idx => {
    if (!lm[idx]) return
    const p = proj(idx)
    drawDot(ctx, p.x, p.y, 1.2)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────
export function LandmarkDrawer({ data, width, height, mirrored = true }: LandmarkDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    if (!data || !data.landmarks.length) return

    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'

    if (data.mode === 'face') {
      const ok        = data.isValid
      const primary   = ok ? '#22c55e' : '#ef4444'
      const secondary = ok ? '#86efac' : '#fca5a5'
      const dot       = ok ? '#16a34a' : '#dc2626'

      // Draw primary face first
      drawFaceMesh(ctx, data.landmarks, width, height, mirrored, primary, secondary, dot)

      // Extra faces (if any) — always red with a warning label
      if (data.allLandmarks.length > 1) {
        for (let i = 1; i < data.allLandmarks.length; i++) {
          const extraLm = data.allLandmarks[i]
          drawFaceMesh(ctx, extraLm, width, height, mirrored, '#ef4444', '#fca5a5', '#dc2626')

          // "Extra face" label near the top of the extra face
          const nosePt = extraLm[1]
          if (nosePt) {
            const px = mirrored ? (1 - nosePt.x) * width  : nosePt.x * width
            const py = nosePt.y * height - 20
            ctx.font         = 'bold 11px sans-serif'
            ctx.fillStyle    = '#ef4444'
            ctx.textAlign    = 'center'
            ctx.fillText('Extra face detected', px, Math.max(py, 14))
          }
        }
      }

    } else {
      // ── Hand mode ──────────────────────────────────────────────────────────
      // Draw all detected hands; second hand is always red with a label
      const drawHand = (lm: LM[], ok: boolean, isExtra: boolean) => {
        const primary   = (ok && !isExtra) ? '#22c55e' : '#ef4444'
        const secondary = (ok && !isExtra) ? '#86efac' : '#fca5a5'
        const dot       = (ok && !isExtra) ? '#16a34a' : '#dc2626'

        for (const [a, b] of HAND_CONNECTIONS) {
          if (!lm[a] || !lm[b]) continue
          const pa = project(lm[a], width, height, mirrored)
          const pb = project(lm[b], width, height, mirrored)
          const isThumbSeg = THUMB_INDICES.has(a) || THUMB_INDICES.has(b)
          ctx.strokeStyle = (!isExtra && ok && !isThumbSeg) ? secondary : primary
          ctx.lineWidth   = 2
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.lineTo(pb.x, pb.y)
          ctx.stroke()
        }

        lm.forEach((point, idx) => {
          const p = project(point, width, height, mirrored)
          ctx.fillStyle = (!isExtra && ok) ? (THUMB_INDICES.has(idx) ? dot : secondary) : primary
          const r = idx === 4 ? 4 : idx === 0 ? 3 : 2
          drawDot(ctx, p.x, p.y, r)
        })

        // Label for extra hand
        if (isExtra && lm[9]) {
          const wp = project(lm[9], width, height, mirrored)
          ctx.font      = 'bold 11px sans-serif'
          ctx.fillStyle = '#ef4444'
          ctx.textAlign = 'center'
          ctx.fillText('Put one hand down', wp.x, Math.max(wp.y - 20, 14))
        }
      }

      const ok = data.isValid
      drawHand(data.landmarks, ok, false)

      if (data.allLandmarks.length > 1) {
        for (let i = 1; i < data.allLandmarks.length; i++) {
          drawHand(data.allLandmarks[i], false, true)
        }
      }
    }
  }, [data, width, height, mirrored])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ display: data ? 'block' : 'none' }}
    />
  )
}