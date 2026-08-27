import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Strung -- a playable virtual acoustic guitar.
 * Framer code component. Drop it into a Frame of any size; it fills its
 * container and scales its 1280x832 composition to fit. Hover the strings
 * to strum, drag one and release to pluck it, pick a chord from the row
 * under the headline, or use the arrow keys for a full up/down strum.
 *
 * Every id used internally (the SVG gradient/clip-path defs especially) is
 * namespaced to this component instance via useId(), so placing the
 * component more than once on the same page -- or alongside a host site
 * that happens to use similarly short ids -- can't collide.
 */

// ================= static data (module scope: plain data, no DOM) =================

const X0 = 50.94
const X1 = 145.03 // bridge -> nut, in the guitar SVG's raw path-number space

interface StringDef {
  note: string
  freq: number
  y0: number
  y1: number
  w: number
  wound: boolean
}

const STRINGS: StringDef[] = [
  { note: "E2", freq: 82.41, y0: 90.34, y1: 91.56, w: 0.52, wound: true },
  { note: "A2", freq: 110.0, y0: 91.9, y1: 92.59, w: 0.45, wound: true },
  { note: "D3", freq: 146.83, y0: 93.47, y1: 93.53, w: 0.38, wound: true },
  { note: "G3", freq: 196.0, y0: 95.02, y1: 94.64, w: 0.3, wound: false },
  { note: "B3", freq: 246.94, y0: 96.6, y1: 95.67, w: 0.25, wound: false },
  { note: "E4", freq: 329.63, y0: 98.16, y1: 96.69, w: 0.21, wound: false },
]

interface ChordDef {
  name: string
  frets: (number | null)[]
}

// fret per string, low E -> high E; null = muted (skipped when strumming)
const CHORDS: ChordDef[] = [
  { name: "Open", frets: [0, 0, 0, 0, 0, 0] },
  { name: "E", frets: [0, 2, 2, 1, 0, 0] },
  { name: "Em", frets: [0, 2, 2, 0, 0, 0] },
  { name: "A", frets: [null, 0, 2, 2, 2, 0] },
  { name: "Am", frets: [null, 0, 2, 2, 1, 0] },
  { name: "D", frets: [null, null, 0, 2, 3, 2] },
  { name: "Dm", frets: [null, null, 0, 2, 3, 1] },
  { name: "G", frets: [3, 2, 0, 0, 0, 3] },
  { name: "C", frets: [null, 3, 2, 0, 1, 0] },
  { name: "F", frets: [1, 3, 3, 2, 1, 1] },
  { name: "B", frets: [null, 2, 4, 4, 4, 2] },
]

const STRING_TONE = [
  { decay: 0.9975, damping: 0.34 },
  { decay: 0.9975, damping: 0.3 },
  { decay: 0.9973, damping: 0.24 },
  { decay: 0.997, damping: 0.18 },
  { decay: 0.9968, damping: 0.14 },
  { decay: 0.9965, damping: 0.1 },
]

const VFREQ = [9.5, 10.5, 11.6, 12.8, 14.0, 15.4]
const VDAMP = [1.15, 1.35, 1.6, 1.95, 2.3, 2.7]
const MAXAMP = 4.2

const PLUCK_POOL_SIZE = 3

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}
function yAt(i: number, u: number) {
  const s = STRINGS[i]
  return lerp(s.y0, s.y1, u)
}
function uFromX(x: number) {
  return clamp((x - X0) / (X1 - X0), 0.03, 0.97)
}
function fretFreq(i: number, fret: number) {
  return STRINGS[i].freq * Math.pow(2, fret / 12)
}

// ================= component =================

export interface StrungProps {
  /** Text shown as the large faded watermark behind the guitar. */
  name?: string
  style?: React.CSSProperties
}

export default function Strung(props: StrungProps) {
  const { name = "SIDDHANT" } = props

  const rawId = useId().replace(/:/g, "")
  const uid = "sg" + rawId
  const gid = (s: string) => uid + s
  const gref = (s: string) => `url(#${uid}${s})`
  const ghref = (s: string) => `#${uid}${s}`

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const hitRef = useRef<SVGRectElement>(null)
  const liveGRef = useRef<SVGGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kbdUpRef = useRef<HTMLElement>(null)
  const kbdDownRef = useRef<HTMLElement>(null)

  const [currentChord, setCurrentChord] = useState(0)
  const [narrow, setNarrow] = useState(false)
  const [showRotateGate, setShowRotateGate] = useState(false)

  // ref mirroring state, so the imperative engine (set up once) always
  // reads the current value instead of the one captured at mount.
  const currentChordRef = useRef(currentChord)
  useEffect(() => {
    currentChordRef.current = currentChord
  }, [currentChord])

  const engineRef = useRef<{
    wake: () => void
    sweepStrum: (direction: "D" | "U", velocity: number) => void
  } | null>(null)

  // ---- Google Fonts: inject once into the host document's head ----
  useEffect(() => {
    if (typeof document === "undefined") return
    if (document.getElementById("sg-strung-font")) return
    const pre1 = document.createElement("link")
    pre1.rel = "preconnect"
    pre1.href = "https://fonts.googleapis.com"
    const pre2 = document.createElement("link")
    pre2.rel = "preconnect"
    pre2.href = "https://fonts.gstatic.com"
    pre2.crossOrigin = "anonymous"
    const sheet = document.createElement("link")
    sheet.id = "sg-strung-font"
    sheet.rel = "stylesheet"
    sheet.href =
      "https://fonts.googleapis.com/css2?family=Libertinus+Serif+Display&family=Libertinus+Serif:ital@0;1&display=swap"
    document.head.appendChild(pre1)
    document.head.appendChild(pre2)
    document.head.appendChild(sheet)
  }, [])

  // ---- the engine: audio, string physics, pointer handling, canvas ----
  // ported close to 1:1 from the original vanilla build; the only real
  // changes are (a) everything reads from refs instead of getElementById,
  // (b) sizing comes from a ResizeObserver on the component's own root
  // instead of window.innerWidth/innerHeight, so it behaves correctly
  // whatever size Framer gives it, and (c) the current chord is read from
  // a ref mirroring React state instead of a module-level var.
  useEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const svg = svgRef.current
    const hit = hitRef.current
    const liveG = liveGRef.current
    const canvas = canvasRef.current
    if (!root || !stage || !svg || !hit || !liveG || !canvas) return

    const ctx = canvas.getContext("2d")!
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    function chordFret(i: number): number | null {
      return CHORDS[currentChordRef.current].frets[i]
    }

    // ---- string SVG elements ----
    const stringEls = STRINGS.map((s) => {
      const glow = document.createElementNS(svg!.namespaceURI, "path")
      glow.setAttribute("class", `${uid}-live-string`)
      glow.setAttribute("stroke", s.wound ? "#a5813f" : "#8f8468")
      glow.setAttribute("stroke-width", String(s.w + 0.9))
      glow.setAttribute("opacity", "0")
      liveG!.appendChild(glow)

      const main = document.createElementNS(svg!.namespaceURI, "path")
      main.setAttribute("class", `${uid}-live-string`)
      main.setAttribute("stroke", s.wound ? "#8a7146" : "#9b917b")
      main.setAttribute("stroke-width", String(s.w))
      liveG!.appendChild(main)

      return { glow, main }
    })

    // ---- audio: Karplus-Strong, pooled + warmed off the interactive path ----
    let actx: AudioContext | null = null
    let masterGain: GainNode, analyser: AnalyserNode, convolver: ConvolverNode, reverbGain: GainNode, dryGain: GainNode
    const pluckCache: Record<string, AudioBuffer[]> = {}

    function ensureAudio() {
      if (actx) return
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      actx = new Ctor()
      masterGain = actx.createGain()
      masterGain.gain.value = 0.9
      analyser = actx.createAnalyser()
      analyser.fftSize = 1024
      convolver = actx.createConvolver()
      reverbGain = actx.createGain()
      reverbGain.gain.value = 0.22
      dryGain = actx.createGain()
      dryGain.gain.value = 1.0
      dryGain.connect(masterGain)
      convolver.connect(reverbGain)
      reverbGain.connect(masterGain)
      masterGain.connect(analyser)
      analyser.connect(actx.destination)
    }

    function makeReverbIR(duration: number, decayPow: number) {
      const sr = actx!.sampleRate
      const len = Math.floor(sr * duration)
      const ir = actx!.createBuffer(2, len, sr)
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch)
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPow)
      }
      return ir
    }

    function karplusStrong(freq: number, seconds: number, decay: number, damping: number) {
      const sr = actx!.sampleRate
      const N = Math.max(2, Math.round(sr / freq))
      const buf = new Float32Array(N)
      for (let i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1
      const total = Math.floor(sr * seconds)
      const out = new Float32Array(total)
      let idx = 0,
        lp = 0
      for (let n = 0; n < total; n++) {
        const cur = buf[idx]
        const nextIdx = (idx + 1) % N
        const avg = 0.5 * (cur + buf[nextIdx])
        lp = avg * (1 - damping) + lp * damping
        buf[idx] = decay * lp
        out[n] = cur
        idx = nextIdx
      }
      const fadeIn = Math.min(64, total)
      for (let k = 0; k < fadeIn; k++) out[k] *= k / fadeIn
      return out
    }

    function getPluckBuffer(i: number, freq: number) {
      const key = i + "_" + Math.round(freq * 10)
      const arr = pluckCache[key] || (pluckCache[key] = [])
      if (arr.length < PLUCK_POOL_SIZE) {
        const tone = STRING_TONE[i]
        const data = karplusStrong(freq, 2.6, tone.decay, tone.damping)
        const buf = actx!.createBuffer(1, data.length, actx!.sampleRate)
        buf.copyToChannel(data, 0)
        arr.push(buf)
        return buf
      }
      return arr[(Math.random() * arr.length) | 0]
    }

    let audioWarmed = false
    function warmUpAudio() {
      if (audioWarmed) return
      audioWarmed = true
      ensureAudio()
      convolver.buffer = makeReverbIR(2.6, 3.2)
      for (let i = 0; i < STRINGS.length; i++) {
        for (let v = 0; v < PLUCK_POOL_SIZE; v++) getPluckBuffer(i, STRINGS[i].freq)
      }
    }
    const idleHandle: { id: number; kind: "idle" | "timeout" } =
      "requestIdleCallback" in window
        ? { id: (window as any).requestIdleCallback(warmUpAudio, { timeout: 1500 }), kind: "idle" }
        : { id: window.setTimeout(warmUpAudio, 300), kind: "timeout" }

    function playPluckSound(i: number, amp01: number, freq?: number | null) {
      ensureAudio()
      if (!convolver.buffer) convolver.buffer = makeReverbIR(2.6, 3.2)
      if (actx!.state === "suspended") actx!.resume()
      const vel = clamp(amp01, 0.12, 1)
      const buffer = getPluckBuffer(i, freq || STRINGS[i].freq)
      const src = actx!.createBufferSource()
      src.buffer = buffer
      const gain = actx!.createGain()
      gain.gain.value = 0.55 * vel
      const pan = actx!.createStereoPanner ? actx!.createStereoPanner() : null
      if (pan) pan.pan.value = clamp((i - 2.5) / 3.2, -0.6, 0.6)
      src.connect(gain)
      if (pan) {
        gain.connect(pan)
        pan.connect(dryGain)
        pan.connect(convolver)
      } else {
        gain.connect(dryGain)
        gain.connect(convolver)
      }
      src.onended = () => {
        try {
          src.disconnect()
          gain.disconnect()
          if (pan) pan.disconnect()
        } catch (_e) {}
      }
      src.start()
    }

    function wake() {
      ensureAudio()
      if (actx!.state === "suspended") actx!.resume()
    }

    // ---- visual string physics ----
    const activeStrings: Record<number, { t0: number; amp: number; dir: number }> = {}
    let heldIndex: number | null = null
    let heldOffset = 0
    let heldU = 0.5
    let lastPointer: { x: number; y: number } | null = null
    let lastCross: Record<number, number> = {}
    let lastBand: number | null = null

    function spawnNote(i: number) {
      const s = STRINGS[i]
      const pt = svg!.createSVGPoint()
      pt.x = X1 - 4 - GX
      pt.y = s.y1 - GY
      const sp = pt.matrixTransform(svg!.getScreenCTM()!)
      const rr = root!.getBoundingClientRect()
      const el = document.createElement("div")
      el.className = `${uid}-note-float`
      el.innerHTML = s.note[0] + "<sub>" + s.note[1] + "</sub>"
      el.style.left = sp.x - rr.left + "px"
      el.style.top = sp.y - rr.top - 26 + "px"
      root!.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    }

    function triggerString(i: number, amp: number, dir?: number, freq?: number | null) {
      amp = clamp(Math.abs(amp), 0.8, MAXAMP)
      activeStrings[i] = { t0: performance.now(), amp, dir: dir || 1 }
      playPluckSound(i, amp / MAXAMP, freq)
      spawnNote(i)
    }

    let gateActive = false

    function renderStrings() {
      if (gateActive) {
        raf1 = requestAnimationFrame(renderStrings)
        return
      }
      const now = performance.now()
      const N = 24
      for (let i = 0; i < STRINGS.length; i++) {
        const st = activeStrings[i]
        const pts: string[] = []
        let ringing = false
        let env = 0
        let t = 0
        if (st) {
          t = (now - st.t0) / 1000
          env = st.amp * Math.exp(-VDAMP[i] * t)
          if (env > 0.03) ringing = true
          else delete activeStrings[i]
        }
        for (let k = 0; k <= N; k++) {
          const u = k / N
          const x = lerp(X0, X1, u)
          const y = yAt(i, u)
          let dy = 0
          if (ringing) {
            const shape = Math.sin(Math.PI * u)
            const harmonic = 0.28 * Math.sin(2 * Math.PI * u) * Math.exp(-t * 2.4)
            dy = st.dir * env * (shape + harmonic) * Math.cos(2 * Math.PI * VFREQ[i] * t)
          } else if (heldIndex === i) {
            const peak = u <= heldU ? u / heldU : (1 - u) / (1 - heldU)
            dy = heldOffset * peak
          }
          pts.push(x.toFixed(2) + "," + (y + dy).toFixed(2))
        }
        const d = "M" + pts.join(" L")
        const el = stringEls[i]
        el.main.setAttribute("d", d)
        el.glow.setAttribute("d", d)
        el.glow.setAttribute("opacity", ringing ? clamp(env / MAXAMP, 0, 0.4).toFixed(2) : "0")
      }
      raf1 = requestAnimationFrame(renderStrings)
    }
    let raf1 = requestAnimationFrame(renderStrings)

    // ---- pointer interaction ----
    // the guitar artwork sits inside <g transform="translate(-4.5946 -5.5458)">
    // drawn using the original SVG's raw path numbers -- STRINGS/X0/X1/hit
    // are all specified in that same raw space, one step inside what
    // getScreenCTM() on the outer <svg> maps to/from. every pointer
    // coordinate has to be shifted back into raw space before comparing it
    // against a string's position.
    const GX = 4.5946
    const GY = 5.5458

    function svgPoint(evt: PointerEvent) {
      const pt = svg!.createSVGPoint()
      pt.x = evt.clientX
      pt.y = evt.clientY
      const ctm = svg!.getScreenCTM()
      if (!ctm || ctm.a === 0) return null
      const p = pt.matrixTransform(ctm.inverse())
      return { x: p.x + GX, y: p.y + GY }
    }

    function nearestString(x: number, y: number) {
      const u = uFromX(x)
      let best = -1,
        bestD = 1e9
      for (let i = 0; i < STRINGS.length; i++) {
        const d = Math.abs(yAt(i, u) - y)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return { i: best, d: bestD, u }
    }

    // strings sit close together, so "did the cursor cross this exact line"
    // is too strict for a hover gesture. divide the span into one band per
    // string (boundary = midpoint to its neighbor) and trigger every band
    // the cursor moves through, so a single wave of the hand reaches all six.
    function bandAt(y: number, u: number) {
      for (let i = 0; i < STRINGS.length; i++) {
        const lo = i === 0 ? -1e9 : (yAt(i - 1, u) + yAt(i, u)) / 2
        const hi = i === STRINGS.length - 1 ? 1e9 : (yAt(i, u) + yAt(i + 1, u)) / 2
        if (y >= lo && y < hi) return i
      }
      return -1
    }

    function onDown(evt: PointerEvent) {
      ensureAudio()
      if (actx!.state === "suspended") actx!.resume()
      try {
        hit!.setPointerCapture(evt.pointerId)
      } catch (_e) {}
      const p = svgPoint(evt)
      if (!p) return
      const near = nearestString(p.x, p.y)
      lastPointer = p
      lastCross = {}
      lastBand = bandAt(p.y, near.u)
      if (near.d < 1.1 && !activeStrings[near.i]) {
        heldIndex = near.i
        heldU = clamp(near.u, 0.12, 0.88)
        heldOffset = clamp(p.y - yAt(near.i, heldU), -4, 4)
      } else {
        heldIndex = null
        heldOffset = 0
      }
    }

    // pointermove doubles as the hover-strum driver: no button needs to be
    // held. the first sample after entry rings whichever string the cursor
    // lands on directly, then becomes the baseline for later crossings.
    function onMove(evt: PointerEvent) {
      const p = svgPoint(evt)
      if (!p) return
      if (lastPointer === null) {
        lastPointer = p
        const u0 = uFromX(p.x)
        const band0 = bandAt(p.y, u0)
        lastBand = band0
        if (band0 !== -1 && band0 !== heldIndex) {
          const fret0 = chordFret(band0)
          if (fret0 !== null) triggerString(band0, 1.6, 1, fretFreq(band0, fret0))
        }
        return
      }

      if (heldIndex !== null) {
        heldU = clamp(uFromX(p.x), 0.12, 0.88)
        heldOffset = clamp(p.y - yAt(heldIndex, heldU), -4, 4)
      }

      const u = uFromX(p.x)
      const curBand = bandAt(p.y, u)
      const speed = Math.hypot(p.x - lastPointer.x, p.y - lastPointer.y)
      const amp = clamp(speed * 1.4, 1.2, MAXAMP)
      const now = performance.now()

      if (curBand !== -1 && lastBand !== null && lastBand !== -1 && curBand !== lastBand) {
        const dir = curBand > lastBand ? 1 : -1
        for (let b = lastBand + dir; ; b += dir) {
          if (b === heldIndex) {
            if (b === curBand) break
            else continue
          }
          const fret = chordFret(b)
          if (fret !== null && (!lastCross[b] || now - lastCross[b] > 110)) {
            triggerString(b, amp, dir, fretFreq(b, fret))
            lastCross[b] = now
          }
          if (b === curBand) break
        }
      }
      lastBand = curBand === -1 ? lastBand : curBand
      lastPointer = p
    }

    function onUp() {
      if (heldIndex !== null) {
        const i = heldIndex
        if (Math.abs(heldOffset) > 0.45) {
          triggerString(i, Math.abs(heldOffset) * 1.15, heldOffset > 0 ? -1 : 1)
        } else {
          triggerString(i, 1.8, Math.random() < 0.5 ? 1 : -1)
        }
      }
      heldIndex = null
      heldOffset = 0
    }

    function onLeave(evt: PointerEvent) {
      if (evt.buttons === 0) onUp()
      lastPointer = null
      lastBand = null
    }

    hit.addEventListener("pointerdown", onDown)
    hit.addEventListener("pointermove", onMove)
    hit.addEventListener("pointerup", onUp)
    hit.addEventListener("pointercancel", onUp)
    hit.addEventListener("pointerleave", onLeave)

    function pulseKbd(elRef: HTMLElement | null) {
      if (!elRef) return
      const pressedClass = `${uid}-kbd--pressed`
      elRef.classList.remove(pressedClass)
      void elRef.offsetWidth
      elRef.classList.add(pressedClass)
      setTimeout(() => elRef.classList.remove(pressedClass), 160)
    }

    function sweepStrum(direction: "D" | "U", velocity: number) {
      const order = direction === "D" ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
      order.forEach((i, idx) => {
        const fret = chordFret(i)
        if (fret === null) return
        setTimeout(() => {
          const amp = velocity * (0.85 + Math.random() * 0.3)
          triggerString(i, amp, direction === "D" ? 1 : -1, fretFreq(i, fret))
        }, idx * 15)
      })
    }

    function onWindowKeydown(e: KeyboardEvent) {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 6) {
        ensureAudio()
        if (actx!.state === "suspended") actx!.resume()
        const i = 6 - n
        const fret = chordFret(i)
        triggerString(i, 2.2, Math.random() < 0.5 ? 1 : -1, fret === null ? null : fretFreq(i, fret))
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        wake()
        pulseKbd(kbdDownRef.current)
        sweepStrum("D", 2.6)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        wake()
        pulseKbd(kbdUpRef.current)
        sweepStrum("U", 2.6)
      }
    }
    window.addEventListener("keydown", onWindowKeydown)

    // ---- background canvas: ambient drifting dust ----
    const motes: { x: number; y: number; r: number; speed: number; drift: number; phase: number; baseAlpha: number }[] = []
    let DPR = Math.min(2, window.devicePixelRatio || 1)

    if (!reduceMotion) {
      for (let m = 0; m < 38; m++) {
        motes.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.6 + Math.random() * 1.6,
          speed: 0.00005 + Math.random() * 0.00012,
          drift: (Math.random() - 0.5) * 0.00005,
          phase: Math.random() * Math.PI * 2,
          baseAlpha: 0.05 + Math.random() * 0.12,
        })
      }
    }

    function drawWaves(t: number) {
      if (gateActive) {
        raf2 = requestAnimationFrame(drawWaves)
        return
      }
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)

      for (let m2 = 0; m2 < motes.length; m2++) {
        const mt = motes[m2]
        mt.y -= mt.speed
        mt.x += mt.drift
        if (mt.y < -0.05) mt.y = 1.05
        if (mt.x < -0.05) mt.x = 1.05
        if (mt.x > 1.05) mt.x = -0.05
        const flicker = 0.7 + 0.3 * Math.sin(t * 0.001 + mt.phase)
        ctx.beginPath()
        ctx.fillStyle = "rgba(141,102,58," + (mt.baseAlpha * flicker).toFixed(3) + ")"
        ctx.arc(mt.x * canvas!.width, mt.y * canvas!.height, mt.r * DPR, 0, Math.PI * 2)
        ctx.fill()
      }

      raf2 = requestAnimationFrame(drawWaves)
    }
    let raf2 = requestAnimationFrame(drawWaves)

    // ---- sizing: driven by the component's own box, not the viewport ----
    function fit(w: number, h: number) {
      const s = Math.min(w / 1280, h / 832)
      stage!.style.transform = `translate(-50%,-50%) scale(${s})`
    }
    function resizeCanvas(w: number, h: number) {
      DPR = Math.min(2, window.devicePixelRatio || 1)
      canvas!.width = w * DPR
      canvas!.height = h * DPR
      canvas!.style.width = w + "px"
      canvas!.style.height = h + "px"
    }

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      const w = Math.max(1, cr.width)
      const h = Math.max(1, cr.height)
      fit(w, h)
      resizeCanvas(w, h)
      const nextNarrow = w <= 560
      const nextGate = w < 900 && w < h
      gateActive = nextGate
      setNarrow(nextNarrow)
      setShowRotateGate(nextGate)
    })
    ro.observe(root)
    // run once immediately so the first frame isn't unsized
    const r0 = root.getBoundingClientRect()
    fit(Math.max(1, r0.width), Math.max(1, r0.height))
    resizeCanvas(Math.max(1, r0.width), Math.max(1, r0.height))

    engineRef.current = { wake, sweepStrum }

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      ro.disconnect()
      hit.removeEventListener("pointerdown", onDown)
      hit.removeEventListener("pointermove", onMove)
      hit.removeEventListener("pointerup", onUp)
      hit.removeEventListener("pointercancel", onUp)
      hit.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("keydown", onWindowKeydown)
      if (idleHandle.kind === "idle" && "cancelIdleCallback" in window) {
        ;(window as any).cancelIdleCallback(idleHandle.id)
      } else if (idleHandle.kind === "timeout") {
        window.clearTimeout(idleHandle.id)
      }
      engineRef.current = null
      if (actx) actx.close().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const css = `
    .${uid}-root{
      --sg-cream:#fff6ee;
      --sg-cream-deep:#f6e9dc;
      --sg-ink:#0d0a07;
      --sg-brown:#8d663a;
      --sg-brown-deep:#693a00;
      --sg-watermark:rgba(105,58,0,0.10);
      --sg-serif:'Libertinus Serif Display','Libertinus Serif',Georgia,serif;
      position:relative;
      width:100%;
      height:100%;
      min-height:420px;
      overflow:hidden;
      background:var(--sg-cream);
      color:var(--sg-ink);
      font-family:var(--sg-serif);
      box-sizing:border-box;
    }
    .${uid}-root *{ box-sizing:border-box; }

    .${uid}-backdrop{
      position:absolute; inset:0; z-index:0;
      background:
        radial-gradient(ellipse 55% 60% at 82% 18%, rgba(214,186,155,0.35), transparent 65%),
        radial-gradient(ellipse 45% 50% at 95% 65%, rgba(222,196,166,0.30), transparent 60%),
        radial-gradient(ellipse 70% 55% at 10% 90%, rgba(226,204,178,0.28), transparent 62%),
        radial-gradient(ellipse 60% 45% at 40% 0%, rgba(255,252,247,0.9), transparent 70%),
        var(--sg-cream);
    }
    .${uid}-backdrop::after{
      content:'';
      position:absolute; inset:0;
      background:
        radial-gradient(ellipse 30% 45% at 70% 40%, rgba(255,255,255,0.55), transparent 70%),
        radial-gradient(ellipse 25% 35% at 88% 85%, rgba(255,255,255,0.4), transparent 70%);
      mix-blend-mode:soft-light;
    }

    .${uid}-grain{
      position:absolute; inset:0; z-index:6;
      pointer-events:none;
      opacity:.035;
      mix-blend-mode:multiply;
    }

    .${uid}-canvas{
      position:absolute; inset:0; z-index:1;
      width:100%; height:100%;
      pointer-events:none;
    }

    .${uid}-stage{
      position:absolute;
      left:50%; top:50%;
      width:1280px; height:832px;
      transform:translate(-50%,-50%) scale(1);
      transform-origin:center center;
      z-index:2;
    }

    .${uid}-watermark{
      position:absolute;
      left:128px; top:96px;
      z-index:1;
      font-family:var(--sg-serif);
      font-size:225px;
      line-height:195px;
      letter-spacing:-4.5px;
      color:var(--sg-watermark);
      white-space:nowrap;
      user-select:none;
      pointer-events:none;
    }

    .${uid}-shadow{
      position:absolute;
      left:-90px; top:465px;
      width:1140px; height:410px;
      z-index:2;
      background:radial-gradient(ellipse 52% 50% at 44% 38%, rgba(55,29,6,0.48), transparent 72%);
      filter:blur(62px);
      pointer-events:none;
    }
    .${uid}-shadow-core{
      position:absolute;
      left:60px; top:432px;
      width:700px; height:190px;
      z-index:2;
      background:radial-gradient(ellipse 48% 50% at 45% 40%, rgba(38,19,4,0.42), transparent 68%);
      filter:blur(22px);
      pointer-events:none;
    }

    .${uid}-guitar-wrap{
      position:absolute;
      left:104px; top:186px;
      width:1056px;
      z-index:3;
    }
    .${uid}-guitar-wrap svg{
      width:100%; height:auto;
      overflow:visible;
      display:block;
    }
    .${uid}-hit-layer{ cursor:grab; touch-action:none; }
    .${uid}-hit-layer:active{ cursor:grabbing; }
    .${uid}-live-string{ fill:none; stroke-linecap:round; }

    .${uid}-copy{
      position:absolute;
      left:701px; top:555px;
      z-index:4;
      width:500px;
    }
    .${uid}-overline-row{ display:flex; align-items:center; gap:16px; }
    .${uid}-overline-label{
      font-family:var(--sg-serif);
      font-size:24px;
      letter-spacing:-1.44px;
      color:var(--sg-brown);
      white-space:nowrap;
    }
    .${uid}-rule{ width:307px; height:1px; background:var(--sg-brown); opacity:.75; }
    .${uid}-headline{
      margin:10px 0 0;
      font-family:var(--sg-serif);
      font-size:59.9px;
      line-height:52.7px;
      letter-spacing:-3.6px;
      color:#000;
      max-width:465px;
      text-wrap:balance;
    }

    .${uid}-chord-row{ display:flex; flex-wrap:wrap; align-items:center; gap:7px; }
    .${uid}-chord-chip{
      font-family:var(--sg-serif);
      font-size:14px;
      letter-spacing:-.1px;
      color:var(--sg-brown-deep);
      background:transparent;
      border:1px solid rgba(141,102,58,.35);
      border-radius:999px;
      padding:5px 13px;
      cursor:pointer;
      transition:background .18s ease, color .18s ease, border-color .18s ease, transform .12s ease;
    }
    .${uid}-chord-chip:hover{ border-color:var(--sg-brown); transform:translateY(-1px); }
    .${uid}-chord-chip:focus-visible{ outline:2px solid var(--sg-brown); outline-offset:2px; }
    .${uid}-chord-chip--active{
      background:var(--sg-brown-deep);
      border-color:var(--sg-brown-deep);
      color:var(--sg-cream);
    }

    .${uid}-key-hint{
      display:flex; align-items:center; gap:14px;
      font-family:var(--sg-serif);
      font-style:italic;
      font-size:14px;
      color:rgba(13,10,7,.55);
      white-space:nowrap;
    }
    .${uid}-key-item{ display:inline-flex; align-items:center; gap:6px; }
    .${uid}-kbd{
      display:inline-flex; align-items:center; justify-content:center;
      min-width:22px; height:22px; padding:0 5px;
      border:1px solid rgba(141,102,58,.4);
      border-radius:5px;
      background:rgba(255,250,244,.7);
      font-family:'Libertinus Serif',serif;
      font-style:normal;
      font-size:13px;
      color:var(--sg-brown-deep);
      transition:background .12s ease, transform .1s ease;
    }
    .${uid}-kbd--pressed{ background:var(--sg-brown-deep); color:var(--sg-cream); transform:scale(.92); }

    .${uid}-footer{
      position:absolute;
      left:0; right:0; bottom:0;
      z-index:9;
      display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
      gap:22px;
      padding:16px 28px;
      border-top:1px solid rgba(141,102,58,.18);
      background:rgba(255,250,244,.74);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
    }
    .${uid}-footer-divider{ width:1px; height:20px; background:rgba(141,102,58,.25); }
    .${uid}-root--narrow .${uid}-footer{ gap:12px; padding:12px 16px; }
    .${uid}-root--narrow .${uid}-footer-divider{ display:none; }

    .${uid}-note-float{
      position:absolute;
      z-index:7;
      font-family:var(--sg-serif);
      font-style:italic;
      font-size:22px;
      color:var(--sg-brown);
      pointer-events:none;
      animation:${uid}NoteRise 1.15s ease-out forwards;
    }
    .${uid}-note-float sub{ font-size:.55em; }
    @keyframes ${uid}NoteRise{
      0%{ opacity:0; transform:translate(-50%,0) scale(.85); }
      12%{ opacity:.9; }
      100%{ opacity:0; transform:translate(-50%,-56px) scale(1.05); }
    }

    @media (prefers-reduced-motion: reduce){
      .${uid}-note-float{ animation-duration:.4s; }
    }

    .${uid}-rotate-gate{
      display:flex;
      position:absolute; inset:0; z-index:100;
      flex-direction:column; align-items:center; justify-content:center;
      gap:16px;
      background:var(--sg-cream);
      text-align:center;
      padding:12% 10%;
    }
    .${uid}-rotate-gate-icon{ animation:${uid}RotateHint 1.8s ease-in-out infinite; }
    .${uid}-rotate-gate h2{ margin:0; font-family:var(--sg-serif); font-size:24px; letter-spacing:-.5px; color:var(--sg-brown-deep); }
    .${uid}-rotate-gate p{ margin:0; font-family:'Libertinus Serif',serif; font-style:italic; font-size:15px; color:rgba(13,10,7,.6); max-width:36ch; }
    @keyframes ${uid}RotateHint{
      0%,15%{ transform:rotate(0deg); }
      45%,65%{ transform:rotate(90deg); }
      95%,100%{ transform:rotate(0deg); }
    }
    @media (prefers-reduced-motion: reduce){
      .${uid}-rotate-gate-icon{ animation:none; }
    }
  `

  const rootClass = `${uid}-root${narrow ? ` ${uid}-root--narrow` : ""}`

  return (
    <div ref={rootRef} className={rootClass} style={props.style}>
      <style>{css}</style>

      <div className={`${uid}-backdrop`} />

      {showRotateGate && (
        <div className={`${uid}-rotate-gate`} role="alert">
          <svg
            className={`${uid}-rotate-gate-icon`}
            width="52"
            height="52"
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="15" y="4" width="22" height="44" rx="4" stroke="#693a00" strokeWidth="2.5" />
            <circle cx="26" cy="40" r="1.4" fill="#693a00" />
          </svg>
          <h2>Turn your phone sideways</h2>
          <p>This guitar is a horizontal instrument &mdash; it needs landscape to play properly.</p>
        </div>
      )}

      <canvas ref={canvasRef} className={`${uid}-canvas`} />

      <svg className={`${uid}-grain`} xmlns="http://www.w3.org/2000/svg">
        <filter id={gid("noise")}>
          <feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={gref("noise")} />
      </svg>

      <div className={`${uid}-stage`} ref={stageRef}>
        <div className={`${uid}-watermark`} aria-hidden="true">
          {name}
        </div>
        <div className={`${uid}-shadow`} aria-hidden="true" />
        <div className={`${uid}-shadow-core`} aria-hidden="true" />

        <div className={`${uid}-guitar-wrap`}>
          <svg
            ref={svgRef}
            viewBox="12 56 154 68"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
          >
            <defs>
              <linearGradient id={gid("g")}>
                <stop stopColor="#949494" offset="0" />
                <stop stopColor="#d9d9d9" offset=".39231" />
                <stop stopColor="#c4c4c4" offset=".75361" />
                <stop stopColor="#a5a5a5" offset="1" />
              </linearGradient>
              <linearGradient id={gid("h")}>
                <stop stopColor="#cdcdcd" offset="0" />
                <stop stopColor="#adadad" offset=".58007" />
                <stop stopColor="#e7e7e7" offset="1" />
              </linearGradient>
              <linearGradient id={gid("a")}>
                <stop stopColor="#606060" offset="0" />
                <stop stopColor="#b8b8b8" offset="1" />
              </linearGradient>
              <clipPath id={gid("br")}>
                <path
                  d="m165.5 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.9828 0.70668-3.125 1.2188-3.125 1.2188l-64.75-1.1562-0.03125 4.4375 0.03125 4.4688 64.75-1.1875s1.1422 0.51207 3.125 1.2188c0.85754 0.04999 14.465 0.85324 17.656 1.0625 0.25068-0.09186 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z"
                  fill="#dfdfdf"
                />
              </clipPath>
              <radialGradient
                id={gid("bp")}
                cx="72.312"
                cy="94.103"
                r="8"
                gradientTransform="matrix(1 0 0 .98764 0 1.1636)"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#424242" offset="0" />
                <stop stopColor="#424242" offset=".47329" />
                <stop stopColor="#2c2c2c" offset=".62398" />
                <stop stopColor="#373737" offset="1" />
              </radialGradient>
              <linearGradient
                id={gid("o")}
                x1="149.98"
                x2="150.99"
                y1="89.469"
                y2="89.469"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("h")}
              />
              <linearGradient
                id={gid("n")}
                x1="149.22"
                x2="151.74"
                y1="87.932"
                y2="87.932"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("g")}
              />
              <linearGradient
                id={gid("m")}
                x1="155.36"
                x2="156.37"
                y1="89.06"
                y2="89.06"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("h")}
              />
              <linearGradient
                id={gid("l")}
                x1="154.6"
                x2="157.12"
                y1="87.523"
                y2="87.523"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("g")}
              />
              <linearGradient
                id={gid("k")}
                x1="160.61"
                x2="161.63"
                y1="88.928"
                y2="88.928"
                gradientTransform="translate(0 -.13281)"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("h")}
              />
              <linearGradient
                id={gid("j")}
                x1="159.86"
                x2="162.38"
                y1="87.391"
                y2="87.391"
                gradientTransform="translate(0 -.13281)"
                gradientUnits="userSpaceOnUse"
                xlinkHref={ghref("g")}
              />
              <linearGradient id={gid("bs")} x1="55.154" x2="55.154" y1="124.49" y2="65.602" gradientUnits="userSpaceOnUse">
                <stop stopColor="#bf9c78" offset="0" />
                <stop stopColor="#f1c799" offset="1" />
              </linearGradient>
              <linearGradient id={gid("bt")} x1="20.366" x2="95.031" y1="94.129" y2="94.129" gradientUnits="userSpaceOnUse">
                <stop stopColor="#b29270" offset="0" />
                <stop stopColor="#b29270" stopOpacity="0" offset="1" />
              </linearGradient>
              <linearGradient id={gid("bu")} x1="61.817" x2="61.817" y1="125.6" y2="64.517" gradientUnits="userSpaceOnUse">
                <stop stopColor="#886f55" offset="0" />
                <stop stopColor="#d4af85" offset="1" />
              </linearGradient>
              <linearGradient id={gid("bv")} x1="158.99" x2="158.99" y1="88.399" y2="100.21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#776965" offset="0" />
                <stop stopColor="#5d524f" offset="1" />
              </linearGradient>
              <linearGradient
                id={gid("bw")}
                x1="113.06"
                x2="113.06"
                y1="90.278"
                y2="97.989"
                gradientTransform="matrix(1.0082 0 0 1 -1.1844 0)"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#5b6768" offset="0" />
                <stop stopColor="#3e4647" offset="1" />
              </linearGradient>
              <radialGradient id={gid("e")} cx="150.92" cy="90.943" r=".97227" gradientUnits="userSpaceOnUse">
                <stop stopColor="#9d9d9d" offset="0" />
                <stop stopColor="#d4d4d4" offset=".86364" />
                <stop stopColor="#d4d4d4" offset=".92614" />
                <stop stopColor="#8e8e8e" offset="1" />
              </radialGradient>
              <linearGradient id={gid("bn")} x1="51.354" x2="51.354" y1="82.855" y2="105.35" gradientUnits="userSpaceOnUse">
                <stop stopColor="#464646" offset="0" />
                <stop stopColor="#727272" offset=".22839" />
                <stop stopColor="#5c5c5c" offset=".2532" />
                <stop stopColor="#464646" offset=".5" />
                <stop stopColor="#464646" offset=".75465" />
                <stop stopColor="#373737" offset=".77848" />
                <stop stopColor="#464646" offset="1" />
              </linearGradient>
              <radialGradient id={gid("d")} cx="50.891" cy="89.993" r=".65625" gradientUnits="userSpaceOnUse">
                <stop stopColor="#cecece" stopOpacity=".95686" offset="0" />
                <stop stopColor="#cecece" stopOpacity=".95652" offset=".77538" />
                <stop stopColor="#f6f6f6" stopOpacity="0" offset="1" />
              </radialGradient>
              <radialGradient id={gid("bq")} cx="50.891" cy="89.993" r=".65625" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1a1a1a" offset="0" />
                <stop stopColor="#6a6a6a" stopOpacity=".49804" offset=".82732" />
                <stop stopColor="#b4b4b4" stopOpacity="0" offset="1" />
              </radialGradient>
              <radialGradient id={gid("c")} cx="50.891" cy="89.993" r=".65625" gradientUnits="userSpaceOnUse">
                <stop stopColor="#212121" offset="0" />
                <stop stopColor="#393939" offset=".41491" />
                <stop stopColor="#b4b4b4" stopOpacity="0" offset="1" />
              </radialGradient>
              <radialGradient id={gid("f")} cx="50.891" cy="89.993" r=".65625" gradientUnits="userSpaceOnUse">
                <stop stopColor="#212121" offset="0" />
                <stop stopColor="#6a6a6a" stopOpacity=".49804" offset=".5" />
                <stop stopColor="#b4b4b4" stopOpacity="0" offset="1" />
              </radialGradient>
              <linearGradient id={gid("bo")} x1="48.262" x2="48.925" y1="96.202" y2="96.202" gradientUnits="userSpaceOnUse">
                <stop stopColor="#898989" offset="0" />
                <stop stopColor="#c2c2c2" offset=".5942" />
                <stop stopColor="#a4a4a4" offset="1" />
              </linearGradient>
              <radialGradient id={gid("b")} cx="150.92" cy="90.943" r=".97227" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fff" offset="0" />
                <stop stopColor="#d0d0d0" offset=".75823" />
                <stop stopColor="#a6a6a6" offset="1" />
              </radialGradient>
            </defs>
            <g transform="translate(-4.5946 -5.5458)">
              <path
                transform="matrix(1.6645 0 0 1.6645 -47.895 -61.934)"
                d="m80.312 94.103c0 4.4183-3.5817 8-8 8s-8-3.5817-8-8 3.5817-8 8-8 8 3.5817 8 8z"
                fill={gref("bp")}
              />
              <path d="m149.98 88.959v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("o")} />
              <path
                d="m150.5 86.854c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                fill={gref("n")}
              />
              <path d="m155.36 88.551v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("m")} />
              <path
                d="m155.88 86.445c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                fill={gref("l")}
              />
              <path d="m160.61 88.285v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("k")} />
              <path
                d="m161.14 86.18c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                fill={gref("j")}
              />
              <g transform="matrix(1 0 0 -1 0 188.24)">
                <path d="m149.98 88.959v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("o")} />
                <path
                  d="m150.5 86.854c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                  fill={gref("n")}
                />
                <path d="m155.36 88.551v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("m")} />
                <path
                  d="m155.88 86.445c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                  fill={gref("l")}
                />
                <path d="m160.61 88.285v1.0195h1.0138v-1.0195h-1.0138z" fill={gref("k")} />
                <path
                  d="m161.14 86.18c-0.58793 0-1.0102 0.26121-1.2744 0.5625v1.0938l0.75306 0.5h1.0138l0.75306-0.5v-1.0938c-0.26417-0.30129-0.65752-0.5625-1.2454-0.5625z"
                  fill={gref("j")}
                />
              </g>
              <path
                d="m39.906 65.656c-0.68492 0.0057-1.364 0.04124-2.0625 0.125-18.464 2.2144-17.469 28.344-17.469 28.344s-0.99567 26.13 17.469 28.344c11.175 1.3402 20.518-7.89 31.312-8.9688 6.4769-0.64672 10.408 2.7244 17.594 0 7.3755-2.7962 8.2812-12.602 8.2812-19.375 0-6.7733-0.90573-16.579-8.2812-19.375-7.1862-2.7244-11.117 0.64722-17.594 0-10.12-1.0114-18.976-9.1791-29.25-9.0938zm32.562 21.219c4.0041 0 7.25 3.2459 7.25 7.25s-3.2459 7.25-7.25 7.25-7.25-3.2459-7.25-7.25 3.2459-7.25 7.25-7.25z"
                fill={gref("bs")}
                stroke={gref("bt")}
                strokeWidth=".394"
              />
              <path
                d="m39.906 65.469c-0.69065 0.0057-1.3868 0.04023-2.0938 0.125-4.6618 0.55907-8.0947 2.6154-10.625 5.4062s-4.1522 6.2954-5.1875 9.7188c-2.0705 6.8468-1.8125 13.406-1.8125 13.406s-0.25801 6.5594 1.8125 13.406c1.0353 3.4234 2.6572 6.9279 5.1875 9.7188s5.9632 4.8473 10.625 5.4062c5.6472 0.67724 10.818-1.316 15.906-3.5938s10.121-4.8406 15.469-5.375c3.2008-0.31961 5.7653 0.35784 8.4688 0.78125s5.5268 0.59472 9.1562-0.78125c3.7566-1.4242 5.8723-4.6312 7.0312-8.3125s1.375-7.8546 1.375-11.25-0.21602-7.5687-1.375-11.25-3.2746-6.8883-7.0312-8.3125c-3.6294-1.376-6.4528-1.2047-9.1562-0.78125s-5.2679 1.1011-8.4688 0.78125c-5.0135-0.50102-9.7649-2.7784-14.531-4.9375s-9.5604-4.1994-14.75-4.1562zm0 0.375c5.0842-0.04226 9.8335 1.9687 14.594 4.125s9.5184 4.4584 14.625 4.9688c3.276 0.32737 5.9161-0.36182 8.5938-0.78125s5.412-0.56718 8.9688 0.78125c3.6189 1.372 5.6435 4.4486 6.7812 8.0625s1.375 7.7472 1.375 11.125-0.23724 7.5111-1.375 11.125-3.1624 6.6905-6.7812 8.0625c-3.5568 1.3484-6.2911 1.2006-8.9688 0.78125s-5.3177-1.1084-8.5938-0.78125c-5.4471 0.54436-10.487 3.1342-15.562 5.4062s-10.159 4.2255-15.688 3.5625c-4.5704-0.54799-7.9301-2.5813-10.406-5.3125s-4.0699-6.1767-5.0938-9.5625c-2.0478-6.7716-1.8125-13.281-1.8125-13.281s-0.23526-6.5097 1.8125-13.281c1.0239-3.3858 2.6176-6.8313 5.0938-9.5625s5.8358-4.7644 10.406-5.3125c0.69001-0.08275 1.3521-0.11935 2.0312-0.125zm32.562 20.844c-4.1105 0-7.4375 3.327-7.4375 7.4375s3.327 7.4375 7.4375 7.4375 7.4375-3.327 7.4375-7.4375-3.327-7.4375-7.4375-7.4375zm0 0.375c3.8976 0 7.0625 3.1649 7.0625 7.0625s-3.1649 7.0625-7.0625 7.0625-7.0625-3.1649-7.0625-7.0625 3.1649-7.0625 7.0625-7.0625z"
                fill={gref("bu")}
              />
              <path d="m72.469 85.834c-4.5716 0-8.2821 3.7106-8.2821 8.2821s3.7106 8.2821 8.2821 8.2821c4.5716 0 8.2821-3.7105 8.2821-8.2821s-3.7106-8.2821-8.2821-8.2821zm0 0.31732c4.4014 0 7.9648 3.5635 7.9648 7.9648s-3.5635 7.9648-7.9648 7.9648c-4.4014 0-7.9648-3.5635-7.9648-7.9648s3.5635-7.9648 7.9648-7.9648z" fill="#585e5e" />
              <path d="m72.469 85.244c-4.8972 0-8.8708 3.9736-8.8708 8.8708s3.9736 8.8708 8.8708 8.8708 8.8708-3.9736 8.8708-8.8708-3.9736-8.8708-8.8708-8.8708zm0 0.13753c4.8253 0 8.7332 3.908 8.7332 8.7332 0 4.8253-3.908 8.7332-8.7332 8.7332s-8.7332-3.908-8.7332-8.7332c0-4.8253 3.908-8.7332 8.7332-8.7332z" fill="#a98b6b" />
              <path d="m72.469 84.822c-5.1301 0-9.2928 4.1626-9.2928 9.2928 0 5.1301 4.1626 9.2927 9.2928 9.2927 5.1301 0 9.2928-4.1626 9.2928-9.2927s-4.1626-9.2928-9.2928-9.2928zm0 0.14407c5.0548 0 9.1487 4.0939 9.1487 9.1487s-4.0939 9.1487-9.1487 9.1487-9.1487-4.0939-9.1487-9.1487 4.0939-9.1487 9.1487-9.1487z" fill="#a98b6b" />
              <path d="m72.469 84.957c-5.0705 0-9.1927 4.0869-9.1927 9.1574s4.1222 9.1927 9.1927 9.1927 9.1927-4.1222 9.1927-9.1927-4.1222-9.1574-9.1927-9.1574zm0 0.31699c4.8889 0 8.8404 3.9515 8.8404 8.8404s-3.9515 8.8757-8.8404 8.8757-8.8404-3.9868-8.8404-8.8757 3.9515-8.8404 8.8404-8.8404z" fill="#5c4b3a" />
              <path d="m72.469 83.953c-5.6145 0-10.16 4.5458-10.16 10.16s4.5458 10.2 10.16 10.2 10.16-4.5851 10.16-10.2-4.5458-10.16-10.16-10.16zm0 0.2746c5.4783 0 9.9249 4.4074 9.9249 9.8857s-4.4466 9.9249-9.9249 9.9249-9.9249-4.4466-9.9249-9.9249 4.4466-9.8857 9.9249-9.8857z" fill="#8e755a" />
              <path
                d="m165.62 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.9828 0.70667-3.125 1.2188-3.125 1.2188l-64.75-1.1562-0.03125 4.4375 0.03125 4.4688 64.75-1.1875s1.1422 0.51207 3.125 1.2188c0.85754 0.05 14.465 0.85323 17.656 1.0625 0.25068-0.0919 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z"
                fill="#dfdfdf"
              />
              <path
                d="m165.62 88.562c-3.1917 0.20926-16.799 1.0125-17.656 1.0625-1.3696 0.48811-2.6569 1.0209-3.125 1.2188v6.5625c0.46807 0.19781 1.7554 0.73064 3.125 1.2188 0.85754 0.05 14.465 0.85323 17.656 1.0625 0.25068-0.0919 0.45747-0.31705 0.5625-0.5625-0.0165-1.3776 0-5 0-5s-0.0165-3.6224 0-5c-0.10503-0.24545-0.31182-0.47064-0.5625-0.5625z"
                fill={gref("bv")}
              />
              <path d="m144.84 97.406v-6.5625l-65.279-1.1562-0.03151 4.4375 0.03151 4.4688z" fill={gref("bw")} />
              <path transform="translate(0 .45849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <path transform="translate(5.1707 .65849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <path transform="translate(10.474 .45849)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <path transform="matrix(1 0 0 -1 0 187.79)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <path transform="matrix(1 0 0 -1 5.1707 187.59)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <path transform="matrix(1 0 0 -1 10.474 187.79)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("e")} />
              <g fill="#c8c8c8">
                <path transform="matrix(1.11 0 0 1.11 -9.6836 -10.229)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.11 0 0 1.11 -5.3398 -10.229)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.11 0 0 1.11 2.1446 -12.152)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.2765 0 0 1.2765 -3.6696 -25.9)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.11 0 0 1.11 17.926 -12.039)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.2765 0 0 1.2765 10.846 -25.954)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.11 0 0 1.11 17.926 -8.4687)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
                <path transform="matrix(1.11 0 0 1.11 2.1446 -8.317)" d="m88.996 94.069c0 0.21967-0.17808 0.39775-0.39775 0.39775s-0.39775-0.17808-0.39775-0.39775 0.17808-0.39775 0.39775-0.39775 0.39775 0.17808 0.39775 0.39775z" />
              </g>
              <g clipPath={gref("br")}>
                <path d="m81.938 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m83.688 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m85.531 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m87.469 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m89.5 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m91.688 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m93.969 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m96.438 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m98.969 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m101.66 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m104.59 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m107.62 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m110.88 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m114.28 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m117.91 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m121.72 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m125.81 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m130.06 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m134.62 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
                <path d="m139.44 89.688v8.875h0.34375v-8.875h-0.34375z" fill={gref("a")} />
              </g>
              <path d="m49.719 82.906c0 3.6189-1.1875 4.2778-1.1875 6.1875v10.062c0 1.9098 1.1875 2.5686 1.1875 6.1875h3.875v-22.438h-3.875z" fill={gref("bn")} />
              <path transform="translate(.055562 .35028)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <path transform="translate(.055562 1.9128)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <path transform="translate(.055562 3.4753)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <path transform="translate(.055562 5.0378)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <path transform="translate(.055562 6.6003)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <path transform="translate(.055562 8.1628)" d="m51.547 89.993c0 0.36244-0.29381 0.65625-0.65625 0.65625s-0.65625-0.29381-0.65625-0.65625 0.29381-0.65625 0.65625-0.65625 0.65625 0.29381 0.65625 0.65625z" fill="#cecece" />
              <rect transform="matrix(.99915 -.041298 .041298 .99915 0 0)" x="48.262" y="90.866" width=".66291" height="10.673" ry=".093913" fill={gref("bo")} />
              <path d="m145.64 90.514c-0.79968 0.33023-0.79828 0.32174-0.79828 0.32174v6.571s1e-3 0 0.79828 0.33542z" fill="#dfdfdf" />
              <g fill="#978b6a">
                <path d="m145.03 91.469v0.1875l6.0938 0.21875v-0.21875l-6.0938-0.1875z" />
                <path d="m156.38 91.844-11.344 0.65625v0.1875l11.344-0.6875v-0.15625z" />
                <path d="m161.69 91.625-16.656 1.9062v0.15625l16.656-1.9062v-0.15625z" />
                <path d="m145.03 94.562v0.15625l16.625 1.8438 0.0312-0.15625-16.656-1.8438z" />
                <path d="m145.03 95.594v0.15625l11.312 0.59375v-0.125l-11.312-0.625z" />
                <path d="m151.03 96.344-6 0.28125v0.125l6-0.28125v-0.125z" />
              </g>
              <path transform="matrix(.62234 0 0 .62234 56.998 34.804)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />
              <path transform="matrix(.62234 0 0 .62234 62.168 35.004)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />
              <path transform="matrix(.62234 0 0 .62234 67.472 34.804)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />
              <path transform="matrix(.62234 0 0 -.62234 67.472 153.45)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />
              <path transform="matrix(.62234 0 0 -.62234 56.998 153.45)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />
              <path transform="matrix(.62234 0 0 -.62234 62.168 153.25)" d="m151.9 90.943c0 0.53697-0.4353 0.97227-0.97227 0.97227s-0.97227-0.4353-0.97227-0.97227 0.4353-0.97227 0.97227-0.97227 0.97227 0.4353 0.97227 0.97227z" fill={gref("b")} />

              <g ref={liveGRef} />

              <rect ref={hitRef} className={`${uid}-hit-layer`} x={45} y={83.5} width={103} height={17.5} fill="transparent" />
            </g>
          </svg>
        </div>

        <div className={`${uid}-copy`}>
          <div className={`${uid}-overline-row`}>
            <span className={`${uid}-overline-label`}>Strum the guitar</span>
            <span className={`${uid}-rule`} />
          </div>
          <p className={`${uid}-headline`}>Every note is a string letting go of its tension</p>
        </div>
      </div>

      <footer className={`${uid}-footer`}>
        <div className={`${uid}-chord-row`}>
          {CHORDS.map((c, idx) => (
            <button
              key={c.name}
              type="button"
              className={`${uid}-chord-chip${idx === currentChord ? ` ${uid}-chord-chip--active` : ""}`}
              onClick={() => {
                engineRef.current?.wake()
                setCurrentChord(idx)
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className={`${uid}-footer-divider`} />
        <div className={`${uid}-key-hint`}>
          <span className={`${uid}-key-item`}>
            <kbd ref={kbdUpRef} className={`${uid}-kbd`}>
              &#8593;
            </kbd>{" "}
            strum up
          </span>
          <span className={`${uid}-key-item`}>
            <kbd ref={kbdDownRef} className={`${uid}-kbd`}>
              &#8595;
            </kbd>{" "}
            strum down
          </span>
        </div>
      </footer>
    </div>
  )
}

addPropertyControls(Strung, {
  name: {
    type: ControlType.String,
    title: "Watermark",
    defaultValue: "SIDDHANT",
    placeholder: "SIDDHANT",
  },
})
