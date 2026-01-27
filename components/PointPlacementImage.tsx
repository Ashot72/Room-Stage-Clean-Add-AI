'use client'

import { useRef, useEffect } from 'react'

interface PointPrompt {
  x: number
  y: number
  label: 0 | 1
}

interface PointPlacementImageProps {
  imageUrl: string
  points: PointPrompt[]
  onPointsChange: (points: PointPrompt[]) => void
  currentMode: 0 | 1
}

export default function PointPlacementImage({
  imageUrl,
  points,
  onPointsChange,
  currentMode,
}: PointPlacementImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getNormalizedCoordinates = (
    x: number,
    y: number
  ): { x: number; y: number } | null => {
    if (!containerRef.current || !imageRef.current) return null

    const imgRect = imageRef.current.getBoundingClientRect()

    const relativeX = (x - imgRect.left) / imgRect.width
    const relativeY = (y - imgRect.top) / imgRect.height

    // Clamp to image bounds
    if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) {
      return null
    }

    return { x: relativeX, y: relativeY }
  }

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const coords = getNormalizedCoordinates(e.clientX, e.clientY)
    if (!coords) return

    const newPoint: PointPrompt = {
      x: coords.x,
      y: coords.y,
      label: currentMode,
    }

    // Add the new point (both positive and negative points can have multiple)
    onPointsChange([...points, newPoint])
  }

  // Draw points overlay
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imgRect = imageRef.current.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    // Set canvas size to match image
    canvas.width = imgRect.width
    canvas.height = imgRect.height

    // Position canvas
    canvas.style.position = 'absolute'
    canvas.style.left = `${imgRect.left - containerRect.left}px`
    canvas.style.top = `${imgRect.top - containerRect.top}px`
    canvas.style.width = `${imgRect.width}px`
    canvas.style.height = `${imgRect.height}px`

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Separate positive and negative points for independent numbering
    const positivePoints = points.filter(p => p.label === 1)
    const negativePoints = points.filter(p => p.label === 0)

    // Helper function to draw a point
    const drawPoint = (point: PointPrompt, number: number, color: string) => {
      const x = point.x * canvas.width
      const y = point.y * canvas.height

      // Draw circle
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw number
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(number.toString(), x, y)
    }

    // Draw positive points (green)
    positivePoints.forEach((point, index) => {
      drawPoint(point, index + 1, '#10b981')
    })

    // Draw negative points (red)
    negativePoints.forEach((point, index) => {
      drawPoint(point, index + 1, '#ef4444')
    })
  }, [points, imageRef, containerRef])

  return (
    <div ref={containerRef} className="relative inline-block">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Click to place points"
        className="max-w-full h-auto object-contain cursor-crosshair"
        onClick={handleImageClick}
        draggable={false}
        style={{ display: 'block' }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          position: 'absolute',
          display: 'block',
        }}
      />
    </div>
  )
}
