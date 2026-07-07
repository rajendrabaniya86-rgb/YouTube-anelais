"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/* ---------- Types ---------- */
type Rect = { x: number; y: number; w: number; h: number; angle: number }
type Level = {
  name: string
  hint: string
  car: { x: number; y: number; angle: number }
  spot: Rect
  obstacles: Rect[]
}

/* ---------- World constants ---------- */
const WORLD_W = 800
const WORLD_H = 600
const CAR_L = 46 // length
const CAR_W = 24 // width

/* ---------- Levels ---------- */
const LEVELS: Level[] = [
  {
    name: "Warm Up",
    hint: "Drive forward and stop inside the glowing bay.",
    car: { x: 400, y: 500, angle: -Math.PI / 2 },
    spot: { x: 400, y: 130, w: CAR_W + 22, h: CAR_L + 26, angle: 0 },
    obstacles: [
      { x: 320, y: 130, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 480, y: 130, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
    ],
  },
  {
    name: "Reverse Bay",
    hint: "Back into the tight bay between the two parked cars.",
    car: { x: 200, y: 470, angle: 0 },
    spot: { x: 470, y: 150, w: CAR_W + 16, h: CAR_L + 18, angle: 0 },
    obstacles: [
      { x: 390, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 550, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 470, y: 470, w: 260, h: 26, angle: 0 },
    ],
  },
  {
    name: "Parallel Park",
    hint: "Squeeze sideways into the curb-side gap.",
    car: { x: 150, y: 250, angle: 0 },
    spot: { x: 470, y: 430, w: CAR_L + 30, h: CAR_W + 18, angle: 0 },
    obstacles: [
      { x: 340, y: 430, w: CAR_L + 6, h: CAR_W + 8, angle: 0 },
      { x: 620, y: 430, w: CAR_L + 6, h: CAR_W + 8, angle: 0 },
      { x: 470, y: 520, w: 720, h: 30, angle: 0 },
    ],
  },
  {
    name: "The Squeeze",
    hint: "Thread through the pillars into the angled bay.",
    car: { x: 130, y: 500, angle: -Math.PI / 2 },
    spot: { x: 640, y: 140, w: CAR_W + 18, h: CAR_L + 20, angle: 0 },
    obstacles: [
      { x: 560, y: 140, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 720, y: 140, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 360, y: 300, w: 40, h: 40, angle: 0 },
      { x: 360, y: 430, w: 40, h: 40, angle: 0 },
      { x: 360, y: 170, w: 40, h: 40, angle: 0 },
    ],
  },
]

/* ---------- Geometry helpers ---------- */
function corners(r: Rect) {
  const c = Math.cos(r.angle)
  const s = Math.sin(r.angle)
  const hw = r.w / 2
  const hh = r.h / 2
  const pts = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
  return pts.map((p) => ({ x: r.x + p.x * c - p.y * s, y: r.y + p.x * s + p.y * c }))
}

function overlapOnAxis(a: { x: number; y: number }[], b: { x: number; y: number }[], ax: { x: number; y: number }) {
  let minA = Infinity
  let maxA = -Infinity
  let minB = Infinity
  let maxB = -Infinity
  for (const p of a) {
    const d = p.x * ax.x + p.y * ax.y
    minA = Math.min(minA, d)
    maxA = Math.max(maxA, d)
  }
  for (const p of b) {
    const d = p.x * ax.x + p.y * ax.y
    minB = Math.min(minB, d)
    maxB = Math.max(maxB, d)
  }
  return maxA >= minB && maxB >= minA
}

function rectsCollide(r1: Rect, r2: Rect) {
  const c1 = corners(r1)
  const c2 = corners(r2)
  const axes = [
    { x: Math.cos(r1.angle), y: Math.sin(r1.angle) },
    { x: -Math.sin(r1.angle), y: Math.cos(r1.angle) },
    { x: Math.cos(r2.angle), y: Math.sin(r2.angle) },
    { x: -Math.sin(r2.angle), y: Math.cos(r2.angle) },
  ]
  for (const ax of axes) {
    if (!overlapOnAxis(c1, c2, ax)) return false
  }
  return true
}

// is the car fully inside the spot (all corners within spot bounds)
function insideSpot(car: Rect, spot: Rect) {
  const c = Math.cos(-spot.angle)
  const s = Math.sin(-spot.angle)
  const hw = spot.w / 2
  const hh = spot.h / 2
  for (const p of corners(car)) {
    const dx = p.x - spot.x
    const dy = p.y - spot.y
    const lx = dx * c - dy * s
    const ly = dx * s + dy * c
    if (Math.abs(lx) > hw || Math.abs(ly) > hh) return false
  }
  return true
}

/* ---------- Component ---------- */
type Status = "ready" | "driving" | "crashed" | "parked"

export default function ParkingGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [levelIdx, setLevelIdx] = useState(0)
  const [status, setStatus] = useState<Status>("ready")
  const [best, setBest] = useState<Record<number, number>>({})

  // control refs (avoid re-render in loop)
  const throttleRef = useRef(0) // -1 reverse, 1 forward
  const steerRef = useRef(0) // -1 left, 1 right

  // mutable car state
  const stateRef = useRef({
    x: LEVELS[0].car.x,
    y: LEVELS[0].car.y,
    angle: LEVELS[0].car.angle,
    speed: 0,
    time: 0,
  })
  const statusRef = useRef<Status>("ready")
  const levelRef = useRef(0)

  const resetLevel = useCallback((idx: number) => {
    const lv = LEVELS[idx]
    stateRef.current = { x: lv.car.x, y: lv.car.y, angle: lv.car.angle, speed: 0, time: 0 }
    statusRef.current = "ready"
    setStatus("ready")
    levelRef.current = idx
    setLevelIdx(idx)
    throttleRef.current = 0
    steerRef.current = 0
  }, [])

  /* keyboard support (bonus for desktop) */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === "ArrowUp" || e.key === "w") throttleRef.current = 1
      if (e.key === "ArrowDown" || e.key === "s") throttleRef.current = -1
      if (e.key === "ArrowLeft" || e.key === "a") steerRef.current = -1
      if (e.key === "ArrowRight" || e.key === "d") steerRef.current = 1
      if (e.key === "r") resetLevel(levelRef.current)
    }
    const up = (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "ArrowDown", "s"].includes(e.key)) throttleRef.current = 0
      if (["ArrowLeft", "a", "ArrowRight", "d"].includes(e.key)) steerRef.current = 0
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [resetLevel])

  /* main loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let last = performance.now()

    // handle DPR sizing
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const MAX_FWD = 135
    const MAX_REV = 78
    const ACCEL = 190
    const DRAG = 130
    const TURN = 2.7

    const step = (now: number) => {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05

      const st = stateRef.current
      const active = statusRef.current === "ready" || statusRef.current === "driving"

      if (active) {
        const th = throttleRef.current
        if (th !== 0 && statusRef.current === "ready") {
          statusRef.current = "driving"
          setStatus("driving")
        }
        // acceleration
        if (th > 0) st.speed += ACCEL * dt
        else if (th < 0) st.speed -= ACCEL * dt
        else {
          // natural drag toward 0
          if (st.speed > 0) st.speed = Math.max(0, st.speed - DRAG * dt)
          else if (st.speed < 0) st.speed = Math.min(0, st.speed + DRAG * dt)
        }
        st.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, st.speed))

        // steering only when moving; reverse flips direction
        const dir = st.speed >= 0 ? 1 : -1
        const speedFactor = Math.min(1, Math.abs(st.speed) / 45)
        st.angle += steerRef.current * TURN * speedFactor * dir * dt

        st.x += Math.cos(st.angle) * st.speed * dt
        st.y += Math.sin(st.angle) * st.speed * dt

        if (statusRef.current === "driving") st.time += dt

        const carRect: Rect = { x: st.x, y: st.y, w: CAR_L, h: CAR_W, angle: st.angle }
        const lv = LEVELS[levelRef.current]

        // wall collision
        const cs = corners(carRect)
        let hitWall = false
        for (const p of cs) {
          if (p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) hitWall = true
        }
        let hitObs = hitWall
        if (!hitObs) {
          for (const o of lv.obstacles) {
            if (rectsCollide(carRect, o)) {
              hitObs = true
              break
            }
          }
        }
        if (hitObs) {
          statusRef.current = "crashed"
          setStatus("crashed")
          st.speed = 0
        } else if (
          Math.abs(st.speed) < 6 &&
          statusRef.current === "driving" &&
          insideSpot(carRect, lv.spot)
        ) {
          statusRef.current = "parked"
          setStatus("parked")
          st.speed = 0
          const t = Math.round(st.time * 10) / 10
          setBest((b) => {
            const prev = b[levelRef.current]
            if (prev == null || t < prev) return { ...b, [levelRef.current]: t }
            return b
          })
        }
      }

      draw(ctx, canvas, stateRef.current, LEVELS[levelRef.current], statusRef.current)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [])

  /* pointer button binding helper */
  const bind = (kind: "gas" | "rev" | "left" | "right") => {
    const set = (v: boolean) => {
      if (statusRef.current === "crashed" || statusRef.current === "parked") return
      if (kind === "gas") throttleRef.current = v ? 1 : 0
      if (kind === "rev") throttleRef.current = v ? -1 : 0
      if (kind === "left") steerRef.current = v ? -1 : 0
      if (kind === "right") steerRef.current = v ? 1 : 0
    }
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        set(true)
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault()
        set(false)
      },
      onPointerCancel: () => set(false),
      onLostPointerCapture: () => set(false),
    }
  }

  const lv = LEVELS[levelIdx]
  const bestTime = best[levelIdx]

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {/* HUD */}
      <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Level {levelIdx + 1} / {LEVELS.length}
          </span>
          <span className="text-lg font-semibold leading-tight text-card-foreground">{lv.name}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Best</span>
          <span className="font-mono text-lg font-semibold text-accent">
            {bestTime != null ? `${bestTime.toFixed(1)}s` : "--"}
          </span>
        </div>
      </div>

      {/* Canvas / play area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-[#2b3038] shadow-2xl">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* hint bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
          <p className="rounded-full bg-background/70 px-3 py-1 text-center text-xs text-foreground backdrop-blur-sm">
            {lv.hint}
          </p>
        </div>

        {/* overlays */}
        {(status === "crashed" || status === "parked") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm">
            <div className="text-center">
              <p
                className={`text-2xl font-bold ${status === "parked" ? "text-accent" : "text-destructive"}`}
              >
                {status === "parked" ? "Parked!" : "Crashed!"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "parked"
                  ? `Time ${stateRef.current.time.toFixed(1)}s`
                  : "Watch the other cars and walls."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => resetLevel(levelIdx)}
                className="rounded-lg bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-border"
              >
                Retry
              </button>
              {status === "parked" && levelIdx < LEVELS.length - 1 && (
                <button
                  onClick={() => resetLevel(levelIdx + 1)}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Next Level
                </button>
              )}
              {status === "parked" && levelIdx === LEVELS.length - 1 && (
                <button
                  onClick={() => resetLevel(0)}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Play Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-stretch justify-between gap-3 pt-1">
        {/* Steering */}
        <div className="flex gap-3">
          <ControlButton label="Steer left" {...bind("left")}>
            <ArrowIcon dir="left" />
          </ControlButton>
          <ControlButton label="Steer right" {...bind("right")}>
            <ArrowIcon dir="right" />
          </ControlButton>
        </div>
        {/* Throttle */}
        <div className="flex gap-3">
          <ControlButton label="Reverse" variant="muted" {...bind("rev")}>
            <span className="text-sm font-bold">R</span>
          </ControlButton>
          <ControlButton label="Accelerate" variant="primary" {...bind("gas")}>
            <ArrowIcon dir="up" />
          </ControlButton>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Hold gas / reverse and steer. Stop fully inside the bay to park. Desktop: arrow keys, R to reset.
      </p>
    </div>
  )
}

/* ---------- Control button ---------- */
function ControlButton({
  children,
  label,
  variant = "surface",
  ...handlers
}: {
  children: React.ReactNode
  label: string
  variant?: "surface" | "primary" | "muted"
} & React.HTMLAttributes<HTMLButtonElement>) {
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground active:brightness-90"
      : variant === "muted"
        ? "bg-muted text-foreground active:bg-border"
        : "bg-card text-card-foreground active:bg-muted"
  return (
    <button
      aria-label={label}
      className={`flex h-16 w-16 select-none items-center justify-center rounded-2xl border border-border shadow-lg transition-transform active:scale-95 ${styles}`}
      style={{ touchAction: "none" }}
      {...handlers}
    >
      {children}
    </button>
  )
}

function ArrowIcon({ dir }: { dir: "up" | "left" | "right" }) {
  const rot = dir === "up" ? 0 : dir === "left" ? -90 : 90
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${rot}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

/* ---------- Rendering ---------- */
function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  car: { x: number; y: number; angle: number; speed: number },
  lv: Level,
  status: Status,
) {
  const cw = canvas.width
  const ch = canvas.height
  const scale = Math.min(cw / WORLD_W, ch / WORLD_H)
  const offX = (cw - WORLD_W * scale) / 2
  const offY = (ch - WORLD_H * scale) / 2

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  ctx.setTransform(scale, 0, 0, scale, offX, offY)

  // asphalt
  ctx.fillStyle = "#33383f"
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  // subtle grid / lane texture
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 2
  for (let x = 0; x <= WORLD_W; x += 50) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, WORLD_H)
    ctx.stroke()
  }
  for (let y = 0; y <= WORLD_H; y += 50) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WORLD_W, y)
    ctx.stroke()
  }

  // border wall
  ctx.strokeStyle = "#e0a44a"
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6)

  // parking spot
  const parked = status === "parked"
  ctx.save()
  ctx.translate(lv.spot.x, lv.spot.y)
  ctx.rotate(lv.spot.angle)
  ctx.fillStyle = parked ? "rgba(80,210,170,0.28)" : "rgba(80,210,170,0.12)"
  ctx.fillRect(-lv.spot.w / 2, -lv.spot.h / 2, lv.spot.w, lv.spot.h)
  ctx.strokeStyle = parked ? "#5fe0b5" : "#4fd0a5"
  ctx.lineWidth = 3
  ctx.setLineDash([12, 8])
  ctx.strokeRect(-lv.spot.w / 2, -lv.spot.h / 2, lv.spot.w, lv.spot.h)
  ctx.setLineDash([])
  // P marker
  ctx.fillStyle = "rgba(95,224,181,0.8)"
  ctx.font = "bold 22px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("P", 0, 0)
  ctx.restore()

  // obstacles
  for (const o of lv.obstacles) {
    const isCar = o.w <= 90 && o.h <= 90 && Math.min(o.w, o.h) >= 20 && Math.max(o.w, o.h) <= 70
    ctx.save()
    ctx.translate(o.x, o.y)
    ctx.rotate(o.angle)
    if (isCar) {
      drawCarBody(ctx, o.w, o.h, "#8891a0", "#6b7280")
    } else {
      // wall / curb
      ctx.fillStyle = "#4a5058"
      roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 4)
      ctx.fill()
      ctx.strokeStyle = "#e0a44a"
      ctx.lineWidth = 3
      ctx.setLineDash([10, 6])
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.restore()
  }

  // player car
  ctx.save()
  ctx.translate(car.x, car.y)
  ctx.rotate(car.angle)
  const crashed = status === "crashed"
  drawCarBody(ctx, CAR_L, CAR_W, crashed ? "#c65b4e" : "#e0a44a", crashed ? "#a8483d" : "#c78b34", true)
  ctx.restore()
}

function drawCarBody(
  ctx: CanvasRenderingContext2D,
  len: number,
  wid: number,
  body: string,
  stroke: string,
  isPlayer = false,
) {
  // shadow
  ctx.save()
  ctx.translate(2, 3)
  ctx.fillStyle = "rgba(0,0,0,0.25)"
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6)
  ctx.fill()
  ctx.restore()

  // body (len is along x axis = heading)
  ctx.fillStyle = body
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = stroke
  ctx.stroke()

  // windshield
  ctx.fillStyle = "rgba(30,40,55,0.75)"
  roundRect(ctx, len * 0.06, -wid / 2 + 3, len * 0.24, wid - 6, 3)
  ctx.fill()
  // rear window
  roundRect(ctx, -len * 0.3, -wid / 2 + 3, len * 0.22, wid - 6, 3)
  ctx.fill()

  if (isPlayer) {
    // headlights at front (+x)
    ctx.fillStyle = "#fff6da"
    roundRect(ctx, len / 2 - 4, -wid / 2 + 2, 3, 5, 1)
    ctx.fill()
    roundRect(ctx, len / 2 - 4, wid / 2 - 7, 3, 5, 1)
    ctx.fill()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
