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
  {
    name: "Crowded Lot",
    hint: "Slip into the only free bay in a packed parking lot.",
    car: { x: 400, y: 520, angle: -Math.PI / 2 },
    spot: { x: 400, y: 150, w: CAR_W + 16, h: CAR_L + 18, angle: 0 },
    obstacles: [
      { x: 240, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 320, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 480, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 560, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 240, y: 320, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 560, y: 320, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
    ],
  },
  {
    name: "Angled Bay",
    hint: "Line up with the tilted bay and glide in.",
    car: { x: 160, y: 480, angle: 0 },
    spot: { x: 600, y: 200, w: CAR_W + 18, h: CAR_L + 22, angle: Math.PI / 6 },
    obstacles: [
      { x: 520, y: 250, w: CAR_W + 8, h: CAR_L + 10, angle: Math.PI / 6 },
      { x: 680, y: 150, w: CAR_W + 8, h: CAR_L + 10, angle: Math.PI / 6 },
      { x: 360, y: 400, w: 40, h: 40, angle: 0 },
      { x: 400, y: 130, w: 260, h: 26, angle: 0 },
    ],
  },
  {
    name: "Zig Zag",
    hint: "Weave between the walls and back into the far bay.",
    car: { x: 120, y: 120, angle: Math.PI / 2 },
    spot: { x: 660, y: 480, w: CAR_W + 16, h: CAR_L + 18, angle: 0 },
    obstacles: [
      { x: 260, y: 200, w: 26, h: 260, angle: 0 },
      { x: 460, y: 380, w: 26, h: 260, angle: 0 },
      { x: 580, y: 480, w: CAR_W + 8, h: CAR_L + 10, angle: 0 },
      { x: 660, y: 300, w: 200, h: 26, angle: 0 },
    ],
  },
  {
    name: "Master Class",
    hint: "The ultimate test: tight parallel park among pillars.",
    car: { x: 130, y: 200, angle: 0 },
    spot: { x: 470, y: 450, w: CAR_L + 22, h: CAR_W + 14, angle: 0 },
    obstacles: [
      { x: 355, y: 450, w: CAR_L + 4, h: CAR_W + 6, angle: 0 },
      { x: 590, y: 450, w: CAR_L + 4, h: CAR_W + 6, angle: 0 },
      { x: 470, y: 540, w: 720, h: 30, angle: 0 },
      { x: 300, y: 250, w: 40, h: 40, angle: 0 },
      { x: 560, y: 250, w: 40, h: 40, angle: 0 },
      { x: 430, y: 250, w: 40, h: 40, angle: 0 },
    ],
  },
]

/* ---------- Scoring & rating ---------- */
function ratingFor(time: number) {
  if (time <= 7) return 3
  if (time <= 12) return 2
  return 1
}
function scoreFor(time: number) {
  const stars = ratingFor(time)
  const base = stars === 3 ? 500 : stars === 2 ? 350 : 200
  return base
}

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

/* ---------- Audio (WebAudio, no assets) ---------- */
type Audio = {
  ctx: AudioContext
  engineGain: GainNode
  osc: OscillatorNode
}
function createAudio(): Audio | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const engineGain = ctx.createGain()
    engineGain.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 500
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.value = 55
    osc.connect(filter)
    filter.connect(engineGain)
    engineGain.connect(ctx.destination)
    osc.start()
    return { ctx, engineGain, osc }
  } catch {
    return null
  }
}
function setEngine(a: Audio | null, active: boolean, speedFrac: number) {
  if (!a) return
  const g = a.engineGain.gain
  const now = a.ctx.currentTime
  const target = active ? 0.015 + speedFrac * 0.05 : 0
  g.setTargetAtTime(target, now, 0.08)
  a.osc.frequency.setTargetAtTime(50 + speedFrac * 95, now, 0.08)
}
function tone(a: Audio | null, freq: number, dur: number, type: OscillatorType = "square", vol = 0.14) {
  if (!a) return
  const now = a.ctx.currentTime
  const o = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(vol, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  o.connect(g)
  g.connect(a.ctx.destination)
  o.start(now)
  o.stop(now + dur + 0.02)
}
function crashSound(a: Audio | null) {
  if (!a) return
  tone(a, 90, 0.35, "sawtooth", 0.25)
  tone(a, 60, 0.4, "square", 0.2)
}
function successSound(a: Audio | null) {
  if (!a) return
  ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(a, f, 0.22, "triangle", 0.16), i * 110))
}

/* ---------- Component ---------- */
type Status = "ready" | "driving" | "crashed" | "parked"
type Phase = "menu" | "playing" | "handoff" | "results"
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type Skid = { x: number; y: number; a: number }
type Sensor = { prox: number; aligned: boolean }

const CONFETTI_COLORS = ["#e0a44a", "#5fe0b5", "#f5f1e6", "#c78b34"]

export default function ParkingGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [levelIdx, setLevelIdx] = useState(0)
  const [status, setStatus] = useState<Status>("ready")
  const [best, setBest] = useState<Record<number, number>>({})
  const [totalScore, setTotalScore] = useState(0)
  const [lastPoints, setLastPoints] = useState(0)
  const [lastStars, setLastStars] = useState(0)
  const scoredRef = useRef<Record<number, boolean>>({})

  // multiplayer (local pass & play)
  const [phase, setPhase] = useState<Phase>("menu")
  const [names, setNames] = useState<string[]>(["Player 1", "Player 2"])
  const [numPlayers, setNumPlayers] = useState(1)
  const [scores, setScores] = useState<number[]>([0, 0])
  const [curPlayer, setCurPlayer] = useState(0)
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)

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

  // juice refs
  const audioRef = useRef<Audio | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const skidsRef = useRef<Skid[]>([])
  const shakeRef = useRef({ mag: 0, t: 0 })
  const sensorRef = useRef<Sensor>({ prox: 0, aligned: false })
  const beepAccRef = useRef(0)

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = createAudio()
    if (audioRef.current && audioRef.current.ctx.state === "suspended") {
      audioRef.current.ctx.resume().catch(() => {})
    }
  }, [])

  const resetLevel = useCallback((idx: number) => {
    const lv = LEVELS[idx]
    stateRef.current = { x: lv.car.x, y: lv.car.y, angle: lv.car.angle, speed: 0, time: 0 }
    statusRef.current = "ready"
    setStatus("ready")
    levelRef.current = idx
    setLevelIdx(idx)
    throttleRef.current = 0
    steerRef.current = 0
    particlesRef.current = []
    skidsRef.current = []
    shakeRef.current = { mag: 0, t: 0 }
    sensorRef.current = { prox: 0, aligned: false }
  }, [])

  // start a fresh run for the current player
  const startRun = useCallback(() => {
    scoredRef.current = {}
    setTotalScore(0)
    setBest({})
    setPhase("playing")
    resetLevel(0)
  }, [resetLevel])

  // begin a whole new game from the menu
  const beginGame = useCallback(
    (players: number) => {
      ensureAudio()
      setNumPlayers(players)
      setScores([0, 0])
      setCurPlayer(0)
      startRun()
    },
    [startRun, ensureAudio],
  )

  // called when the LAST level is parked — commit score, then hand off or finish
  const finishPlayerRun = useCallback(() => {
    setScores((prev) => {
      const next = [...prev]
      next[curPlayer] = totalScore
      return next
    })
    if (numPlayers === 2 && curPlayer === 0) {
      setPhase("handoff")
    } else {
      setPhase("results")
    }
  }, [curPlayer, numPlayers, totalScore])

  // second player takes over
  const startSecondPlayer = useCallback(() => {
    ensureAudio()
    setCurPlayer(1)
    startRun()
  }, [startRun, ensureAudio])

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

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    const MAX_FWD = 95
    const MAX_REV = 58
    const ACCEL = 130
    const DRAG = 115
    const TURN = 2.5

    const step = (now: number) => {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05

      const st = stateRef.current
      const active = statusRef.current === "ready" || statusRef.current === "driving"
      const a = mutedRef.current ? null : audioRef.current

      if (active) {
        const th = throttleRef.current
        if (th !== 0 && statusRef.current === "ready") {
          statusRef.current = "driving"
          setStatus("driving")
        }
        if (th > 0) st.speed += ACCEL * dt
        else if (th < 0) st.speed -= ACCEL * dt
        else {
          if (st.speed > 0) st.speed = Math.max(0, st.speed - DRAG * dt)
          else if (st.speed < 0) st.speed = Math.min(0, st.speed + DRAG * dt)
        }
        st.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, st.speed))

        const dir = st.speed >= 0 ? 1 : -1
        const speedFactor = Math.min(1, Math.abs(st.speed) / 45)
        st.angle += steerRef.current * TURN * speedFactor * dir * dt

        st.x += Math.cos(st.angle) * st.speed * dt
        st.y += Math.sin(st.angle) * st.speed * dt

        if (statusRef.current === "driving") st.time += dt

        // engine audio
        setEngine(a, statusRef.current === "driving" || Math.abs(st.speed) > 1, Math.abs(st.speed) / MAX_FWD)

        // skid marks when turning hard at speed
        if (Math.abs(steerRef.current) > 0 && Math.abs(st.speed) > 55) {
          const rear = { x: st.x - Math.cos(st.angle) * CAR_L * 0.35, y: st.y - Math.sin(st.angle) * CAR_L * 0.35 }
          skidsRef.current.push({ x: rear.x, y: rear.y, a: st.angle })
          if (skidsRef.current.length > 160) skidsRef.current.shift()
        }

        const carRect: Rect = { x: st.x, y: st.y, w: CAR_L, h: CAR_W, angle: st.angle }
        const lv = LEVELS[levelRef.current]

        // parking-sensor proximity + alignment
        const dx = st.x - lv.spot.x
        const dy = st.y - lv.spot.y
        const dist = Math.hypot(dx, dy)
        const prox = Math.max(0, Math.min(1, 1 - dist / 260))
        let da = Math.abs(((st.angle - lv.spot.angle) % Math.PI + Math.PI) % Math.PI)
        if (da > Math.PI / 2) da = Math.PI - da
        const aligned = prox > 0.55 && da < 0.22
        sensorRef.current = { prox, aligned }

        // reverse-sensor beeps: faster as you approach
        if (statusRef.current === "driving" && prox > 0.3 && a) {
          beepAccRef.current -= dt
          if (beepAccRef.current <= 0) {
            tone(a, aligned ? 1500 : 1000, 0.05, "square", 0.08)
            beepAccRef.current = aligned ? 0.09 : 0.55 - prox * 0.42
          }
        }

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
          shakeRef.current = { mag: 9, t: 0.4 }
          setEngine(a, false, 0)
          crashSound(a)
          st.speed = 0
        } else if (Math.abs(st.speed) < 6 && statusRef.current === "driving" && insideSpot(carRect, lv.spot)) {
          statusRef.current = "parked"
          setStatus("parked")
          st.speed = 0
          setEngine(a, false, 0)
          successSound(a)
          // confetti burst
          for (let i = 0; i < 46; i++) {
            const ang = Math.random() * Math.PI * 2
            const sp = 60 + Math.random() * 180
            particlesRef.current.push({
              x: st.x,
              y: st.y,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              life: 1,
              color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            })
          }
          const t = Math.round(st.time * 10) / 10
          const stars = ratingFor(t)
          setLastStars(stars)
          setBest((b) => {
            const prev = b[levelRef.current]
            if (prev == null || t < prev) return { ...b, [levelRef.current]: t }
            return b
          })
          const pts = scoreFor(t)
          setLastPoints(pts)
          if (!scoredRef.current[levelRef.current]) {
            scoredRef.current[levelRef.current] = true
            setTotalScore((s) => s + pts)
          }
        }
      } else {
        setEngine(a, false, 0)
      }

      // update particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.96
        p.vy = p.vy * 0.96 + 40 * dt
        p.life -= dt * 0.9
        if (p.life <= 0) parts.splice(i, 1)
      }

      // shake decay
      if (shakeRef.current.t > 0) {
        shakeRef.current.t -= dt
        shakeRef.current.mag *= 0.9
      }

      draw(ctx, canvas, stateRef.current, LEVELS[levelRef.current], statusRef.current, {
        particles: parts,
        skids: skidsRef.current,
        shake: shakeRef.current,
        sensor: sensorRef.current,
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [phase])

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
        ensureAudio()
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

  const toggleMute = () => {
    setMuted((m) => {
      mutedRef.current = !m
      return !m
    })
  }

  const lv = LEVELS[levelIdx]
  const bestTime = best[levelIdx]

  /* ----- Menu screen ----- */
  if (phase === "menu") {
    return (
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground text-balance">Parking Challenge</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            8 levels. Beat the clock, earn up to 3 stars, and top the scoreboard.
          </p>
        </div>

        <div className="flex flex-col gap-3 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Player 1 name</span>
            <input
              value={names[0]}
              onChange={(e) => setNames((n) => [e.target.value, n[1]])}
              maxLength={14}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Player 2 name (for 2-player)
            </span>
            <input
              value={names[1]}
              onChange={(e) => setNames((n) => [n[0], e.target.value])}
              maxLength={14}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => beginGame(1)}
            className="flex-1 rounded-lg bg-muted px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border"
          >
            Solo
          </button>
          <button
            onClick={() => beginGame(2)}
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            2 Players
          </button>
        </div>
      </div>
    )
  }

  /* ----- Handoff screen (between players) ----- */
  if (phase === "handoff") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Turn complete</p>
        <div>
          <p className="text-lg text-card-foreground">{names[0] || "Player 1"} scored</p>
          <p className="font-mono text-4xl font-bold text-primary">{scores[0]}</p>
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          Pass the device to {names[1] || "Player 2"} and tap start when ready.
        </p>
        <button
          onClick={startSecondPlayer}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {(names[1] || "Player 2") + "'s turn"}
        </button>
      </div>
    )
  }

  /* ----- Results screen ----- */
  if (phase === "results") {
    const p1 = scores[0]
    const p2 = scores[1]
    const solo = numPlayers === 1
    const winner = solo ? null : p1 === p2 ? "tie" : p1 > p2 ? 0 : 1
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-card-foreground text-balance">
          {solo
            ? "Course Complete!"
            : winner === "tie"
              ? "It's a Tie!"
              : `${names[winner as number] || `Player ${(winner as number) + 1}`} Wins!`}
        </h2>
        <div className="flex w-full flex-col gap-2">
          <div
            className={`flex items-center justify-between rounded-lg px-4 py-3 ${
              winner === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <span className="font-semibold">{names[0] || "Player 1"}</span>
            <span className="font-mono text-lg font-bold">{p1}</span>
          </div>
          {!solo && (
            <div
              className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                winner === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <span className="font-semibold">{names[1] || "Player 2"}</span>
              <span className="font-mono text-lg font-bold">{p2}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setPhase("menu")}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Play Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {/* HUD */}
      <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {numPlayers === 2 ? `${names[curPlayer] || `Player ${curPlayer + 1}`} · ` : ""}Level {levelIdx + 1} /{" "}
            {LEVELS.length}
          </span>
          <span className="text-lg font-semibold leading-tight text-card-foreground">{lv.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Best</span>
            <span className="font-mono text-lg font-semibold text-accent">
              {bestTime != null ? `${bestTime.toFixed(1)}s` : "--"}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Score</span>
            <span className="font-mono text-lg font-semibold text-primary">{totalScore}</span>
          </div>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-border"
          >
            {muted ? <MuteIcon /> : <SoundIcon />}
          </button>
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
              <p className={`text-2xl font-bold ${status === "parked" ? "text-accent" : "text-destructive"}`}>
                {status === "parked" ? "Perfect Park!" : "Crashed!"}
              </p>
              {status === "parked" && <StarRow stars={lastStars} />}
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "parked" ? `Time ${stateRef.current.time.toFixed(1)}s` : "Watch the other cars and walls."}
              </p>
              {status === "parked" && <p className="mt-2 font-mono text-xl font-bold text-primary">+{lastPoints} pts</p>}
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
                  onClick={finishPlayerRun}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {numPlayers === 2 && curPlayer === 0 ? "Finish Turn" : "See Results"}
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
        Hold gas / reverse and steer. Listen for the parking sensor — faster beeps mean you&apos;re close. Stop fully
        inside the bay to park.
      </p>
    </div>
  )
}

/* ---------- Small UI bits ---------- */
function StarRow({ stars }: { stars: number }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-1">
      {[1, 2, 3].map((i) => (
        <Star key={i} filled={i <= stars} />
      ))}
    </div>
  )
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className={filled ? "text-primary" : "text-muted"}>
      <path
        d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.2l1.2-6.6L2.5 9l6.6-.9L12 2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SoundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M23 9l-6 6M17 9l6 6" />
    </svg>
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
  extra: { particles: Particle[]; skids: Skid[]; shake: { mag: number; t: number }; sensor: Sensor },
) {
  const cw = canvas.width
  const ch = canvas.height
  const scale = Math.min(cw / WORLD_W, ch / WORLD_H)
  const shakeX = extra.shake.t > 0 ? (Math.random() - 0.5) * extra.shake.mag : 0
  const shakeY = extra.shake.t > 0 ? (Math.random() - 0.5) * extra.shake.mag : 0
  const offX = (cw - WORLD_W * scale) / 2 + shakeX
  const offY = (ch - WORLD_H * scale) / 2 + shakeY

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

  // skid marks
  ctx.fillStyle = "rgba(20,22,26,0.5)"
  for (const s of extra.skids) {
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.a)
    ctx.fillRect(-4, -CAR_W / 2 + 2, 8, 3)
    ctx.fillRect(-4, CAR_W / 2 - 5, 8, 3)
    ctx.restore()
  }

  // border wall
  ctx.strokeStyle = "#e0a44a"
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6)

  // parking spot — glows with proximity, turns solid green when aligned
  const parked = status === "parked"
  const glow = parked ? 1 : extra.sensor.prox
  ctx.save()
  ctx.translate(lv.spot.x, lv.spot.y)
  ctx.rotate(lv.spot.angle)
  const fillA = 0.1 + glow * 0.25
  ctx.fillStyle = extra.sensor.aligned || parked ? `rgba(95,224,181,${0.2 + glow * 0.25})` : `rgba(80,210,170,${fillA})`
  ctx.fillRect(-lv.spot.w / 2, -lv.spot.h / 2, lv.spot.w, lv.spot.h)
  ctx.strokeStyle = extra.sensor.aligned || parked ? "#7fffd0" : "#4fd0a5"
  ctx.lineWidth = 3
  ctx.setLineDash([12, 8])
  ctx.strokeRect(-lv.spot.w / 2, -lv.spot.h / 2, lv.spot.w, lv.spot.h)
  ctx.setLineDash([])
  ctx.fillStyle = `rgba(127,255,208,${0.5 + glow * 0.4})`
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

  // confetti particles
  for (const p of extra.particles) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6)
  }
  ctx.globalAlpha = 1
}

function drawCarBody(
  ctx: CanvasRenderingContext2D,
  len: number,
  wid: number,
  body: string,
  stroke: string,
  isPlayer = false,
) {
  ctx.save()
  ctx.translate(2, 3)
  ctx.fillStyle = "rgba(0,0,0,0.25)"
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = body
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = stroke
  ctx.stroke()

  ctx.fillStyle = "rgba(30,40,55,0.75)"
  roundRect(ctx, len * 0.06, -wid / 2 + 3, len * 0.24, wid - 6, 3)
  ctx.fill()
  roundRect(ctx, -len * 0.3, -wid / 2 + 3, len * 0.22, wid - 6, 3)
  ctx.fill()

  if (isPlayer) {
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
