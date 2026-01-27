'use client'

import { useState, useRef, useEffect } from 'react'
import { X, CheckCircle2, Play } from 'lucide-react'

interface PolygonPoint {
  x: number
  y: number
}

interface ImageSelectorProps {
  imageUrl: string | null
  onSelectionChange: (selection: PolygonPoint[] | null) => void
  disabled?: boolean
  onProcess?: () => void
  showProcessButton?: boolean
  isProcessing?: boolean
}

export default function ImageSelector({ 
  imageUrl, 
  onSelectionChange,
  disabled = false,
  onProcess,
  showProcessButton = false,
  isProcessing = false
}: ImageSelectorProps) {
  const [polygonPoints, setPolygonPoints] = useState<PolygonPoint[]>([])
  const [isClosed, setIsClosed] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageRect, setImageRect] = useState<DOMRect | null>(null)
  const [labelPosition, setLabelPosition] = useState<{ top: number; right: number } | null>(null)

  // Clear polygon state on mount (when component remounts due to key change)
  useEffect(() => {
    setPolygonPoints([])
    setIsClosed(false)
    setHoverPoint(null)
    onSelectionChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps = run only on mount

  // Also clear when imageUrl changes (additional safety)
  useEffect(() => {
    setPolygonPoints([])
    setIsClosed(false)
    setHoverPoint(null)
    onSelectionChange(null)
  }, [imageUrl, onSelectionChange])

  // Update image rect and label position on scroll/resize
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        const imgElement = containerRef.current.querySelector('img')
        if (imgElement) {
          const rect = imgElement.getBoundingClientRect()
          setImageRect(rect)
          // Calculate label position: top-right of image, fixed to viewport
          setLabelPosition({
            top: rect.top + 8,
            right: window.innerWidth - rect.right + 8,
          })
        }
      }
    }
    updateRect()
    const interval = setInterval(updateRect, 16) // ~60fps for smooth tracking
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [imageUrl])

  const getNormalizedCoordinates = (
    x: number, 
    y: number
  ): { x: number; y: number } | null => {
    if (!containerRef.current) return null

    // Get the actual img element's bounding rect
    const imgElement = containerRef.current.querySelector('img')
    if (!imgElement) return null
    
    const imgRect = imgElement.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    
    // Convert viewport coordinates to container-relative coordinates
    // Account for scroll position
    const containerX = x - containerRect.left + containerRef.current.scrollLeft
    const containerY = y - containerRect.top + containerRef.current.scrollTop
    
    // Calculate image position relative to container (accounting for scroll)
    const imgContainerLeft = imgRect.left - containerRect.left + containerRef.current.scrollLeft
    const imgContainerTop = imgRect.top - containerRect.top + containerRef.current.scrollTop
    
    // Calculate position relative to the actual displayed image
    const relativeX = (containerX - imgContainerLeft) / imgRect.width
    const relativeY = (containerY - imgContainerTop) / imgRect.height

    // Clamp to image bounds
    if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) {
      return null
    }

    return { x: relativeX, y: relativeY }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || !imageUrl) return

    e.preventDefault()
    e.stopPropagation()

    // Update image rect on click to ensure accuracy
    if (containerRef.current) {
      const imgElement = containerRef.current.querySelector('img')
      if (imgElement) {
        const rect = imgElement.getBoundingClientRect()
        setImageRect(rect)
      }
    }

    const coords = getNormalizedCoordinates(e.clientX, e.clientY)
    if (!coords) return

    // If polygon is closed, reopen it when adding a new point
    if (isClosed) {
      setIsClosed(false)
    }

    // Check if clicking near the first point to close the polygon
    if (polygonPoints.length >= 3 && !isClosed) {
      const firstPoint = polygonPoints[0]
      const distance = Math.sqrt(
        Math.pow(coords.x - firstPoint.x, 2) + Math.pow(coords.y - firstPoint.y, 2)
      )
      if (distance < 0.02) {
        // Close the polygon
        setIsClosed(true)
        onSelectionChange(polygonPoints)
        return
      }
    }

    // Add new point
    setPolygonPoints(prev => [...prev, coords])
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !imageUrl) return

    // Update image rect on mouse move to ensure accuracy
    if (containerRef.current) {
      const imgElement = containerRef.current.querySelector('img')
      if (imgElement) {
        const rect = imgElement.getBoundingClientRect()
        setImageRect(rect)
      }
    }

    const coords = getNormalizedCoordinates(e.clientX, e.clientY)
    if (coords) {
      setHoverPoint(coords)
    } else {
      setHoverPoint(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && polygonPoints.length >= 3 && !isClosed) {
      e.preventDefault()
      closePolygon()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      clearSelection()
    }
  }

  const clearSelection = () => {
    setPolygonPoints([])
    setIsClosed(false)
    setHoverPoint(null)
    onSelectionChange(null)
  }

  const closePolygon = () => {
    if (polygonPoints.length >= 3) {
      setIsClosed(true)
      onSelectionChange(polygonPoints)
    }
  }

  // Draw polygon overlay
  useEffect(() => {
    if (!containerRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get the actual img element's current bounding rect
    const imgElement = containerRef.current.querySelector('img')
    if (!imgElement) return
    
    const currentImgRect = imgElement.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    
    // Update imageRect state if it changed
    if (!imageRect || 
        imageRect.width !== currentImgRect.width || 
        imageRect.height !== currentImgRect.height ||
        imageRect.left !== currentImgRect.left ||
        imageRect.top !== currentImgRect.top) {
      setImageRect(currentImgRect)
    }

    // Set canvas size to match displayed image size
    canvas.width = currentImgRect.width
    canvas.height = currentImgRect.height

    // Position canvas to match image position relative to container
    // Account for scroll position: getBoundingClientRect() gives viewport coords,
    // but we need container-relative coords for absolute positioning
    const scrollLeft = containerRef.current.scrollLeft
    const scrollTop = containerRef.current.scrollTop
    
    canvas.style.position = 'absolute'
    canvas.style.left = `${currentImgRect.left - containerRect.left + scrollLeft}px`
    canvas.style.top = `${currentImgRect.top - containerRect.top + scrollTop}px`
    canvas.style.width = `${currentImgRect.width}px`
    canvas.style.height = `${currentImgRect.height}px`

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (polygonPoints.length > 0) {
      ctx.strokeStyle = '#3b82f6'
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
      ctx.lineWidth = 2

      ctx.beginPath()
      const firstPoint = polygonPoints[0]
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height)

      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x * canvas.width, polygonPoints[i].y * canvas.height)
      }

      if (isClosed) {
        ctx.closePath()
        ctx.fill()
      } else if (hoverPoint) {
        ctx.lineTo(hoverPoint.x * canvas.width, hoverPoint.y * canvas.height)
      }

      ctx.stroke()

      // Draw points
      ctx.fillStyle = '#3b82f6'
      polygonPoints.forEach((point, index) => {
        ctx.beginPath()
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI)
        ctx.fill()
        if (index === 0 && polygonPoints.length >= 3) {
          // Highlight first point when ready to close
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 8, 0, 2 * Math.PI)
          ctx.stroke()
        }
      })
    }
  }, [polygonPoints, hoverPoint, isClosed, imageRect])

  if (!imageUrl) return null

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-black"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="relative w-full flex justify-center">
        <img
          src={imageUrl}
          alt="Selection"
          className="max-w-full h-auto object-contain select-none"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
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

      {/* Instructions - Fixed to top-right of image */}
      {!isClosed && labelPosition && (
        <div 
          className="fixed bg-black/60 px-4 py-2 rounded text-xs text-white/80 z-20 pointer-events-none"
          style={{
            top: `${labelPosition.top}px`,
            right: `${labelPosition.right}px`,
          }}
        >
          {polygonPoints.length === 0
            ? 'Click to start drawing polygon'
            : polygonPoints.length < 3
            ? `Click to add point (${polygonPoints.length}/3+)`
            : 'Click near first point or press Enter to close polygon'}
        </div>
      )}

      {/* Clear selection button - always on the left, static position */}
      {(polygonPoints.length > 0 || isClosed) && (
        <button
          onClick={clearSelection}
          className="absolute top-4 left-4 bg-red-500/90 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors z-20 flex items-center gap-1.5"
        >
          <X size={14} />
          <span>Clear Selection</span>
        </button>
      )}

      {/* Close polygon button - appears below Clear Selection when polygon has 3+ points */}
      {!isClosed && polygonPoints.length >= 3 && (
        <button
          onClick={closePolygon}
          className="absolute top-16 left-4 bg-green-500/90 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors z-20 flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          <span>Close Polygon</span>
        </button>
      )}

      {/* Process button - appears when polygon is closed and showProcessButton is true, positioned below Clear Selection */}
      {isClosed && showProcessButton && onProcess && (
        <button
          onClick={onProcess}
          disabled={disabled || isProcessing}
          className="absolute top-16 left-4 bg-blue-500/90 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-20 flex items-center gap-1.5"
        >
          {isProcessing ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Process</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
