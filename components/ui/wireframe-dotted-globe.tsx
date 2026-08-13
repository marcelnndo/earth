"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
}

export default function RotatingEarth({ width = 800, height = 600, className = "" }: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const containerWidth = Math.min(width, window.innerWidth - 40)
    const containerHeight = Math.min(height, window.innerHeight - 100)
    const radius = Math.min(containerWidth, containerHeight) / 2.5

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    // Bikin bintang galaksi secara acak
    const numStars = 400
    const stars = Array.from({ length: numStars }, () => ({
      x: Math.random() * containerWidth,
      y: Math.random() * containerHeight,
      r: Math.random() * 1.5,
      alpha: Math.random() * 0.8 + 0.2
    }))

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }
      return inside
    }

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry
      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        if (!pointInPolygon(point, coordinates[0])) return false
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) return false
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) return true
          }
        }
        return false
      }
      return false
    }

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds
      const stepSize = dotSpacing * 0.08
      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat]
          if (pointInFeature(point, feature)) {
            dots.push(point)
          }
        }
      }
      return dots
    }

    interface DotData {
      lng: number
      lat: number
      visible: boolean
    }

    const allDots: DotData[] = []
    let landFeatures: any

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)

      // 1. Gambar Latar Belakang Galaksi (Gradien Biru Malam ke Hitam)
      const gradient = context.createRadialGradient(
        containerWidth / 2, containerHeight / 2, 0,
        containerWidth / 2, containerHeight / 2, containerWidth
      )
      gradient.addColorStop(0, "#0b0b1a")
      gradient.addColorStop(1, "#000000")
      context.fillStyle = gradient
      context.fillRect(0, 0, containerWidth, containerHeight)

      // 2. Gambar Bintang-bintang
      stars.forEach((star) => {
        context.beginPath()
        context.arc(star.x, star.y, star.r, 0, 2 * Math.PI)
        context.fillStyle = `rgba(255, 255, 255, ${star.alpha})`
        context.fill()
      })

      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius

      // 3. Gambar Dasar Bumi (Hitam pekat untuk menutupi bintang di belakangnya)
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "#000000"
      context.fill()
      context.strokeStyle = "rgba(255, 255, 255, 0.2)"
      context.lineWidth = 2 * scaleFactor
      context.stroke()

      if (landFeatures) {
        // Graticule (Garis bujur & lintang)
        const graticule = d3.geoGraticule()
        context.beginPath()
        path(graticule())
        context.strokeStyle = "rgba(255, 255, 255, 0.1)"
        context.lineWidth = 1 * scaleFactor
        context.stroke()

        // Garis batas daratan
        context.beginPath()
        landFeatures.features.forEach((feature: any) => {
          path(feature)
        })
        context.strokeStyle = "rgba(255, 255, 255, 0.5)"
        context.lineWidth = 1 * scaleFactor
        context.stroke()

        // Titik-titik daratan
        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            context.beginPath()
            context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI)
            context.fillStyle = "#aaaaaa"
            context.fill()
          }
        })
      }
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        )
        if (!response.ok) throw new Error("Failed to load land data")
        landFeatures = await response.json()
        landFeatures.features.forEach((feature: any) => {
          const dots = generateDotsInPolygon(feature, 16)
          dots.forEach(([lng, lat]) => {
            allDots.push({ lng, lat, visible: true })
          })
        })
        render()
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load land map data")
        setIsLoading(false)
      }
    }

    const rotation: [number, number] = [0, 0]
    let autoRotate = true
    const rotationSpeed = 0.3 // Sedikit diperlambat biar lebih sinematik

    const rotate = () => {
      if (autoRotate) {
        rotation[0] += rotationSpeed
        projection.rotate(rotation)
        render()
      }
    }

    const rotationTimer = d3.timer(rotate)

    let isDragging = false
    let dragStartPos = { x: 0, y: 0 }

    const handleMouseDown = (event: MouseEvent) => {
      autoRotate = false
      isDragging = false
      dragStartPos = { x: event.clientX, y: event.clientY }
      const startX = event.clientX
      const startY = event.clientY
      const startRotation: [number, number] = [...rotation]
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Deteksi apakah user beneran nge-drag atau cuma nge-klik
        if (Math.abs(moveEvent.clientX - dragStartPos.x) > 3 || Math.abs(moveEvent.clientY - dragStartPos.y) > 3) {
          isDragging = true
        }

        const sensitivity = 0.5
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        rotation[0] = startRotation[0] + dx * sensitivity
        rotation[1] = startRotation[1] - dy * sensitivity
        rotation[1] = Math.max(-90, Math.min(90, rotation[1]))
        projection.rotate(rotation)
        render()
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        setTimeout(() => { 
          if (!isDragging) autoRotate = true 
        }, 3000)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    // ANIMASI KLIK UNTUK PINDAH KE TITIK TERTENTU
    const handleClick = (event: MouseEvent) => {
      if (isDragging) return // Jangan animasi kalau user lagi muter bumi manual

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      // Hitung posisi lintang & bujur dari koordinat X,Y yang diklik
      const coords = projection.invert([x, y])

      if (coords) {
        autoRotate = false
        const currentRotation = projection.rotate()
        // Rumus agar koordinat yang diklik berada persis di tengah layar
        const targetRotation: [number, number, number] = [-coords[0], -coords[1], currentRotation[2]]

        // Animasi halus pergerakan buminya (berlangsung 1.2 detik)
        d3.transition()
          .duration(1200)
          .tween("rotate", () => {
            const r = d3.interpolate(currentRotation, targetRotation)
            return (t) => {
              const current = r(t)
              rotation[0] = current[0]
              rotation[1] = current[1]
              projection.rotate(current)
              render()
            }
          })
          .on("end", () => {
             // Lanjut muter otomatis setelah 3 detik
             setTimeout(() => { autoRotate = true }, 3000)
          })
      }
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
      const newRadius = Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * scaleFactor))
      projection.scale(newRadius)
      render()
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("click", handleClick)
    canvas.addEventListener("wheel", handleWheel)
    loadWorldData()

    return () => {
      rotationTimer.stop()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("click", handleClick)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [width, height])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center bg-neutral-900 rounded-2xl p-8 ${className}`}>
        <div className="text-center">
          <p className="dark text-red-500 font-semibold mb-2">Error loading Earth visualization</p>
          <p className="dark text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-2xl bg-black"
        style={{ maxWidth: "100%", height: "auto", cursor: "crosshair" }}
      />
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 px-3 py-2 rounded-md bg-white/10 backdrop-blur-md border border-white/10">
        Klik tempat mana saja untuk memutar bumi • Drag • Scroll
      </div>
    </div>
  )
}
