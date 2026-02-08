"use client"

import { useEffect, useRef, useState } from "react"

interface Vector2D {
  x: number
  y: number
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 }
  vel: Vector2D = { x: 0, y: 0 }
  acc: Vector2D = { x: 0, y: 0 }
  target: Vector2D = { x: 0, y: 0 }

  closeEnoughTarget = 100
  maxSpeed = 1.0
  maxForce = 0.1
  particleSize = 10
  isKilled = false

  startColor = { r: 0, g: 0, b: 0 }
  targetColor = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.01

  move() {
    // Check if particle is close enough to its target to slow down
    let proximityMult = 1
    const distance = Math.sqrt(Math.pow(this.pos.x - this.target.x, 2) + Math.pow(this.pos.y - this.target.y, 2))

    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    // Add force towards target
    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }

    const magnitude = Math.sqrt(towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y)
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    }

    const steerMagnitude = Math.sqrt(steer.x * steer.x + steer.y * steer.y)
    if (steerMagnitude > 0) {
      steer.x = (steer.x / steerMagnitude) * this.maxForce
      steer.y = (steer.y / steerMagnitude) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y

    // Move particle
    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(
    ctx: CanvasRenderingContext2D,
    drawAsPoints: boolean,
    scale: number,
    centerX: number,
    centerY: number,
  ) {
    // Blend towards target color
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }

    // Calculate current color
    const currentColor = {
      r: Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight),
      g: Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight),
      b: Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight),
    }

    const drawX = centerX + (this.pos.x - centerX) * scale
    const drawY = centerY + (this.pos.y - centerY) * scale

    if (drawAsPoints) {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.fillRect(drawX, drawY, 2, 2)
    } else {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.beginPath()
      ctx.arc(drawX, drawY, (this.particleSize / 2) * scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  kill(width: number, height: number) {
    if (!this.isKilled) {
      // Set target outside the scene
      const randomPos = this.generateRandomPos(width / 2, height / 2, (width + height) / 2)
      this.target.x = randomPos.x
      this.target.y = randomPos.y

      // Begin blending color to black
      this.startColor = {
        r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
      }
      this.targetColor = { r: 0, g: 0, b: 0 }
      this.colorWeight = 0

      this.isKilled = true
    }
  }

  private generateRandomPos(x: number, y: number, mag: number): Vector2D {
    const randomX = Math.random() * 1000
    const randomY = Math.random() * 500

    const direction = {
      x: randomX - x,
      y: randomY - y,
    }

    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
    if (magnitude > 0) {
      direction.x = (direction.x / magnitude) * mag
      direction.y = (direction.y / magnitude) * mag
    }

    return {
      x: x + direction.x,
      y: y + direction.y,
    }
  }
}

interface ParticleTextEffectProps {
  words?: string[]
}

const DEFAULT_WORDS = ["FERNANDO", "VERISSIMO", "&", "FABIANO", "LANA", " APRESENTAM", "SCARLET"]

interface Floater {
  pos: Vector2D
  vel: Vector2D
  size: number
  color: string
}

export function ParticleTextEffect({ words = DEFAULT_WORDS }: ParticleTextEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const animationRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const [isPortrait, setIsPortrait] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const audioPlayHandlerRef = useRef<() => void>(() => {})
  const particlesRef = useRef<Particle[]>([])
  const floatersRef = useRef<Floater[]>([])
  const frameCountRef = useRef(0)
  const wordIndexRef = useRef(0)
  const activeWordRef = useRef("")
  const wordScaleRef = useRef(1)
  const wordFrameRef = useRef(0)
  const mouseRef = useRef({ x: 0, y: 0, isPressed: false, isRightClick: false })

  const pixelSteps = 4
  const drawAsPoints = true
  const baseWidth = 1400
  const baseHeight = 650
  const isMobile = Math.max(
    typeof window !== "undefined" ? window.innerWidth : 0,
    typeof window !== "undefined" ? window.innerHeight : 0,
  ) <= 900

  const generateRandomPos = (x: number, y: number, mag: number): Vector2D => {
    const randomX = Math.random() * 1000
    const randomY = Math.random() * 500

    const direction = {
      x: randomX - x,
      y: randomY - y,
    }

    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
    if (magnitude > 0) {
      direction.x = (direction.x / magnitude) * mag
      direction.y = (direction.y / magnitude) * mag
    }

    return {
      x: x + direction.x,
      y: y + direction.y,
    }
  }

  const nextWord = (word: string, canvas: HTMLCanvasElement, wordIndex: number) => {
    activeWordRef.current = word
    const cleanWord = word.trim().toUpperCase()
    wordScaleRef.current = 1
    wordFrameRef.current = 0
    // const ctx = canvas.getContext("2d")!

    const { width, height } = sizeRef.current

    // Create off-screen canvas for text rendering
    const offscreenCanvas = document.createElement("canvas")
    offscreenCanvas.width = width
    offscreenCanvas.height = height
    const offscreenCtx = offscreenCanvas.getContext("2d")!

    const fontSize = Math.max(90, Math.min(200, Math.floor(width * 0.15)))

    // Draw text
    offscreenCtx.fillStyle = "white"
    offscreenCtx.font = `bold ${fontSize}px Arial`
    offscreenCtx.textAlign = "center"
    offscreenCtx.textBaseline = "middle"
    offscreenCtx.fillText(word, width / 2, height / 2)

    const imageData = offscreenCtx.getImageData(0, 0, width, height)
    const pixels = imageData.data

    // Generate new color
    const wordKey = cleanWord
    const newColor =
      wordKey === "FERNANDO" || wordKey === "VERISSIMO"
        ? { r: 70, g: 170, b: 255 }
        : wordKey === "FABIANO" || wordKey === "LANA"
          ? { r: 255, g: 140, b: 60 }
          : wordKey === "SCARLET"
            ? wordIndex === 0
              ? { r: 40, g: 120, b: 255 }
              : { r: 220, g: 20, b: 60 }
            : {
                r: Math.random() * 255,
                g: Math.random() * 255,
                b: Math.random() * 255,
              }

    const particles = particlesRef.current
    let particleIndex = 0

    // Collect coordinates
    const coordsIndexes: number[] = []
    for (let i = 0; i < pixels.length; i += pixelSteps * 4) {
      coordsIndexes.push(i)
    }

    // Shuffle coordinates for fluid motion
    for (let i = coordsIndexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[coordsIndexes[i], coordsIndexes[j]] = [coordsIndexes[j], coordsIndexes[i]]
    }

    for (const coordIndex of coordsIndexes) {
      const pixelIndex = coordIndex
      const alpha = pixels[pixelIndex + 3]

      if (alpha > 0) {
        const x = (pixelIndex / 4) % width
        const y = Math.floor(pixelIndex / 4 / width)

        let particle: Particle

        if (particleIndex < particles.length) {
          particle = particles[particleIndex]
          particle.isKilled = false
          particleIndex++
        } else {
          particle = new Particle()

          const randomPos = generateRandomPos(width / 2, height / 2, (width + height) / 2)
          particle.pos.x = randomPos.x
          particle.pos.y = randomPos.y

          particle.maxSpeed = Math.random() * 6 + 4
          particle.maxForce = particle.maxSpeed * 0.05
          particle.particleSize = Math.random() * 6 + 6
          particle.colorBlendRate = Math.random() * 0.0275 + 0.0025

          particles.push(particle)
        }

        // Set color transition
        particle.startColor = {
          r: particle.startColor.r + (particle.targetColor.r - particle.startColor.r) * particle.colorWeight,
          g: particle.startColor.g + (particle.targetColor.g - particle.startColor.g) * particle.colorWeight,
          b: particle.startColor.b + (particle.targetColor.b - particle.startColor.b) * particle.colorWeight,
        }
        particle.targetColor = newColor
        particle.colorWeight = 0

        particle.target.x = x
        particle.target.y = y
      }
    }

    // Kill remaining particles
    for (let i = particleIndex; i < particles.length; i++) {
      particles[i].kill(width, height)
    }
  }

  const animate = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")!
    const particles = particlesRef.current
    const floaters = floatersRef.current
    const { width, height } = sizeRef.current
    const centerX = width / 2
    const centerY = height / 2

    const currentWord = activeWordRef.current.trim().toUpperCase()
    wordFrameRef.current += 1
    if (currentWord === "SCARLET" && wordFrameRef.current > 20) {
      // Heartbeat pulse after the word settles: 3 beats then rest
      const t = wordFrameRef.current - 20
      const beats = 3
      const beatFrames = 60
      const totalFrames = beats * beatFrames
      if (t <= totalFrames) {
        const phase = (t % beatFrames) / beatFrames
        const envelope = 1 - Math.min(Math.floor(t / beatFrames) / beats, 0.9)
        wordScaleRef.current = 1 + 0.12 * Math.sin(phase * Math.PI * 2) * envelope
      } else {
        wordScaleRef.current = 1
      }
    } else {
      wordScaleRef.current = 1
    }
    const drawScale = wordScaleRef.current

    // Background with light motion blur (keep background visible)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)"
    ctx.fillRect(0, 0, width, height)

    // Update and draw floaters
    for (const floater of floaters) {
      floater.pos.x += floater.vel.x
      floater.pos.y += floater.vel.y

      if (floater.pos.x < 0 || floater.pos.x > width) {
        floater.vel.x *= -1
      }
      if (floater.pos.y < 0 || floater.pos.y > height) {
        floater.vel.y *= -1
      }

      ctx.fillStyle = floater.color
      ctx.beginPath()
      ctx.arc(floater.pos.x, floater.pos.y, floater.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]
      particle.move()
      particle.draw(ctx, drawAsPoints, drawScale, centerX, centerY)

      // Remove dead particles that are out of bounds
      if (particle.isKilled) {
        if (
          particle.pos.x < 0 ||
          particle.pos.x > width ||
          particle.pos.y < 0 ||
          particle.pos.y > height
        ) {
          particles.splice(i, 1)
        }
      }
    }

    // Handle mouse interaction
    if (mouseRef.current.isPressed && mouseRef.current.isRightClick) {
      particles.forEach((particle) => {
        const distance = Math.sqrt(
          Math.pow(particle.pos.x - mouseRef.current.x, 2) + Math.pow(particle.pos.y - mouseRef.current.y, 2),
        )
        if (distance < 50) {
          particle.kill(width, height)
        }
      })
    }

    // Auto-advance words
    frameCountRef.current++
    const baseDuration = 200
    const scarletDuration = 320
    const duration = currentWord === "SCARLET" ? scarletDuration : baseDuration
    if (wordFrameRef.current >= duration) {
      wordIndexRef.current = (wordIndexRef.current + 1) % words.length
      nextWord(words[wordIndexRef.current], canvas, wordIndexRef.current)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const audio = audioRef.current
    let handleFirstInteraction: (() => void) | null = null

    if (audio) {
      audioPlayHandlerRef.current = () => setAudioReady(true)
      const tryPlay = () => {
        audio.volume = 1
        audio.play().catch(() => {
          // If autoplay is blocked, wait for user interaction.
        })
      }
      tryPlay()
      audio.addEventListener("play", audioPlayHandlerRef.current, { once: true })

      handleFirstInteraction = () => {
        tryPlay()
        if (handleFirstInteraction) {
          window.removeEventListener("pointerdown", handleFirstInteraction)
          window.removeEventListener("keydown", handleFirstInteraction)
        }
      }
      window.addEventListener("pointerdown", handleFirstInteraction, { once: true })
      window.addEventListener("keydown", handleFirstInteraction, { once: true })
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const portrait = window.innerHeight > window.innerWidth
      setIsPortrait(portrait)
      const viewWidth = portrait ? window.innerHeight : window.innerWidth
      const viewHeight = portrait ? window.innerWidth : window.innerHeight
      const width = isMobile ? viewWidth : Math.min(viewWidth, baseWidth)
      const height = isMobile
        ? viewHeight
        : Math.min(Math.round((width / baseWidth) * baseHeight), viewHeight)
      const dpr = window.devicePixelRatio || 1

      sizeRef.current = { width, height, dpr }
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    if (floatersRef.current.length === 0) {
      const floaters: Floater[] = []
      const { width, height } = sizeRef.current
      for (let i = 0; i < 220; i++) {
        floaters.push({
          pos: { x: Math.random() * width, y: Math.random() * height },
          vel: { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6 },
          size: Math.random() * 1.8 + 0.6,
          color: "rgba(255, 255, 255, 0.35)",
        })
      }
      floatersRef.current = floaters
    }

    // Initialize with first word
    nextWord(words[0], canvas, 0)

    // Start animation
    animate()

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.isPressed = true
      mouseRef.current.isRightClick = e.button === 2
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    const handleMouseUp = () => {
      mouseRef.current.isPressed = false
      mouseRef.current.isRightClick = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("contextmenu", handleContextMenu)

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
      if (handleFirstInteraction) {
        window.removeEventListener("pointerdown", handleFirstInteraction)
        window.removeEventListener("keydown", handleFirstInteraction)
      }
      audio?.removeEventListener("play", audioPlayHandlerRef.current)
      window.removeEventListener("resize", resizeCanvas)
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden">
      <audio ref={audioRef} className="hidden" src="/audio/soundtrack.mp3" autoPlay preload="auto" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/img/background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(4px)",
          transform: isMobile && isPortrait ? "rotate(90deg) scale(1.02)" : "scale(1.01)",
          transformOrigin: "center",
          opacity: 0.9,
        }}
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        {!audioReady && (
          <button
            onClick={() => {
              const audio = audioRef.current
              if (audio) {
                audio.volume = 1
                audio.play().then(() => setAudioReady(true)).catch(() => {})
              }
            }}
            className="absolute top-4 right-4 z-20 rounded-full border border-white/40 bg-black/30 px-3 py-2 text-white shadow-sm backdrop-blur"
            aria-label="Activar música"
          >
            <span
              aria-hidden="true"
              className="inline-block text-lg"
              style={{
                animation: "pulse-heart 1.8s ease-in-out infinite",
                transformOrigin: "center",
              }}
            >
              ♪
            </span>
          </button>
        )}
        <div
          style={{
            transform: isPortrait ? "rotate(90deg)" : "none",
            transformOrigin: "center",
            transition: "transform 200ms ease, width 300ms ease, height 300ms ease",
          }}
        >
          <canvas
            ref={canvasRef}
            className="shadow-none"
            style={{ display: "block", backgroundColor: "transparent" }}
          />
        </div>
      </div>
    </div>
  )
}


