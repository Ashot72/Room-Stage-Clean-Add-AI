'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Download,
  Edit3,
  Eye,
  Music,
  Plus,
  Sofa,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import type { StoredImage } from '@/lib/imageStorage'
import ThumbnailPreview from './ThumbnailPreview'

interface GeneratedVersionsProps {
  images: StoredImage[]
  selectedBefore: string | null
  selectedAfter: string | null
  selectedForClean: string | null
  selectedForStaging: string | null
  selectedForAddItem: string | null
  selectedForView: string | null
  selectedForDifferentAngles: string | null
  selectedForVideo: string | null
  selectedForConvertTo3d: string | null
  selectedForAddAudio: string | null
  onSetImageSelection: (type: 'clean' | 'before' | 'after' | 'staging' | 'add-item' | 'view' | 'different-angles' | 'video' | 'convert-to-3d' | 'add-audio', imageId: string) => void
  onDelete: (imageId: string) => void
  onEnableCanvaEditing: (imageId: string) => void
}

export default function GeneratedVersions({
  images,
  selectedBefore,
  selectedAfter,
  selectedForClean,
  selectedForStaging,
  selectedForAddItem,
  selectedForView,
  selectedForDifferentAngles,
  selectedForVideo,
  selectedForConvertTo3d,
  selectedForAddAudio,
  onSetImageSelection,
  onDelete,
  onEnableCanvaEditing,
}: GeneratedVersionsProps) {
  const getContextMenuVerticalOffsetPx = (variant: 'full' | 'restricted') => {
    // Non-video/full menu: move up 30px. Video/3D restricted menu: keep slightly higher.
    return variant === 'full' ? -235 : -55
  }

  const [contextMenu, setContextMenu] = useState<{
    imageId: string
    x: number
    y: number
    openUp: boolean
    variant: 'full' | 'restricted'
    anchorY: number
  } | null>(null)
  const [previewImage, setPreviewImage] = useState<StoredImage | null>(null)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // After opening, re-position using the actual rendered menu height (fixes alignment for full menu).
  useEffect(() => {
    if (!contextMenu) return
    if (!contextMenuRef.current) return

    const raf = window.requestAnimationFrame(() => {
      const el = contextMenuRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const menuHeight = rect.height
      const viewportHeight = window.innerHeight
      const verticalOffsetPx = getContextMenuVerticalOffsetPx(contextMenu.variant)

      // Center around the anchor (thumbnail middle) + desired offset, then clamp.
      let nextTop = contextMenu.anchorY - menuHeight / 2 + verticalOffsetPx
      if (nextTop < 10) nextTop = 10
      if (nextTop + menuHeight > viewportHeight - 10) {
        nextTop = viewportHeight - menuHeight - 10
        if (nextTop < 10) nextTop = 10
      }

      if (Math.abs(nextTop - contextMenu.y) >= 1) {
        setContextMenu((prev) => {
          if (!prev) return prev
          // If the menu changed since scheduling the RAF, ignore this update.
          if (prev.imageId !== contextMenu.imageId) return prev
          return {
            ...prev,
            y: nextTop,
            openUp: nextTop < prev.anchorY,
          }
        })
      }
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu?.imageId, contextMenu?.variant])

  const handleContextMenu = (e: React.MouseEvent, imageId: string) => {
    e.preventDefault()

    const clickedImage = images.find((img) => img.id === imageId)
    const variant: 'full' | 'restricted' =
      clickedImage?.type === 'video' || clickedImage?.type === '3d-object' ? 'restricted' : 'full'

    // Full menu has many items (~420px). Restricted menu (video/3D) shows only View/Download/Delete.
    const menuHeight = variant === 'restricted' ? 160 : 420 // Approximate menu height in pixels
    const viewportHeight = window.innerHeight

    // Anchor menu vertically to the thumbnail's middle (not the click position)
    const thumbRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const anchorY = thumbRect.top + thumbRect.height / 2
    const verticalOffsetPx = getContextMenuVerticalOffsetPx(variant)

    // Center the menu around the thumbnail middle, then clamp into viewport
    let topPosition = anchorY - menuHeight / 2 + verticalOffsetPx
    if (topPosition < 10) topPosition = 10
    if (topPosition + menuHeight > viewportHeight - 10) {
      topPosition = viewportHeight - menuHeight - 10
      if (topPosition < 10) topPosition = 10
    }

    // Also check if menu would go off the right edge
    const menuWidth = 180 // Approximate menu width (slightly wider for longer text)
    const clickX = e.clientX
    const spaceRight = window.innerWidth - clickX
    let leftPosition = clickX
    if (spaceRight < menuWidth) {
      leftPosition = clickX - menuWidth // Position to the left of click point
    }
    // Also check if menu would go off the left edge
    if (leftPosition < 10) {
      leftPosition = 10 // Small margin from left
    }
    
    setContextMenu({
      imageId,
      x: leftPosition,
      y: topPosition,
      openUp: topPosition < anchorY,
      variant,
      anchorY,
    })
  }

  const handleContextAction = (action: 'clean' | 'before' | 'after' | 'staging' | 'add-item' | 'view' | 'view-angles' | 'generate-video' | 'convert-to-3d' | 'add-audio' | 'edit-in-canva' | 'download' | 'delete') => {
    if (!contextMenu) return

    switch (action) {
      case 'clean':
        // Use setImageSelection which handles all logic and saves to localStorage
        onSetImageSelection('clean', contextMenu.imageId)
        break
      case 'before':
        // Use setImageSelection which handles all logic and saves to localStorage
        onSetImageSelection('before', contextMenu.imageId)
        break
      case 'after':
        // Check if "before" is selected first
        if (!selectedBefore) {
          window.alert('Please select an image as "Before" first before setting "After"')
          setContextMenu(null)
          return
        }
        // Use setImageSelection which handles all logic and saves to localStorage
        onSetImageSelection('after', contextMenu.imageId)
        break
      case 'staging':
        // Use setImageSelection which handles all logic and saves to localStorage
        onSetImageSelection('staging', contextMenu.imageId)
        break
      case 'add-item':
        // Use setImageSelection which handles all logic and saves to localStorage
        onSetImageSelection('add-item', contextMenu.imageId)
        break
      case 'view':
        // Always set as view selection - the view mode will check if it's a video and show the player
        onSetImageSelection('view', contextMenu.imageId)
        break
      case 'view-angles':
        // View room with different angles
        onSetImageSelection('different-angles', contextMenu.imageId)
        // TODO: Call API to generate different angles and name
        break
      case 'generate-video':
        // Set image for video generation
        onSetImageSelection('video', contextMenu.imageId)
        break
      case 'convert-to-3d':
        // Set image for 3D conversion
        onSetImageSelection('convert-to-3d', contextMenu.imageId)
        break
      case 'add-audio':
        // Set video for adding audio (MMAudio V2)
        onSetImageSelection('add-audio', contextMenu.imageId)
        break
      case 'edit-in-canva': {
        // Enable the toolbar button instead of redirecting
        onEnableCanvaEditing(contextMenu.imageId)
        break
      }
      case 'download': {
        // Download the image/video/GLB file directly
        const image = images.find(img => img.id === contextMenu.imageId)
        if (image) {
          // For 3D objects, download the GLB file; for videos, download the video file; for others, download the image
          let fileUrl: string
          let fileType: string

          if (image.type === '3d-object' && image.glbUrl) {
            fileUrl = image.glbUrl
            fileType = '3d-object'
          } else if (image.type === 'video' && image.videoUrl) {
            fileUrl = image.videoUrl
            fileType = 'video'
          } else {
            fileUrl = image.url
            fileType = 'image'
          }
          
          // Fetch the file and create a blob URL for download (handles CORS)
          fetch(fileUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              return response.blob()
            })
            .then(blob => {
              const url = window.URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              // Determine file extension from URL
              const extension = fileUrl.match(/\.([^.]+)(?:\?|$)/)?.[1] || 
                (fileType === 'video' ? 'mp4' : fileType === '3d-object' ? 'glb' : 'png')
              link.download = `${fileType}-${image.id}.${extension}`
              link.style.display = 'none'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              window.URL.revokeObjectURL(url)
            })
            .catch(err => {
              console.error('Failed to download file via fetch:', err)
              // Fallback: try direct download
              const link = document.createElement('a')
              link.href = fileUrl
              const extension = fileUrl.match(/\.([^.]+)(?:\?|$)/)?.[1] || 
                (fileType === 'video' ? 'mp4' : fileType === '3d-object' ? 'glb' : 'png')
              link.download = `${fileType}-${image.id}.${extension}`
              link.target = '_blank'
              link.style.display = 'none'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            })
        } else {
          console.error('Image not found for download:', contextMenu.imageId)
        }
        break
      }
      case 'delete':
        if (window.confirm('Are you sure you want to delete this image?')) {
          onDelete(contextMenu.imageId)
        }
        break
    }
    setContextMenu(null)
  }

  const getBadges = (imageId: string) => {
    const badges = []
    // Only show a badge for the active selection mode (View, Generate Video, Add Audio, etc.) — never a standalone "Audio" badge
    if (selectedForView === imageId) badges.push({ label: 'View', color: 'bg-gray-500' })
    if (selectedForDifferentAngles === imageId) badges.push({ label: 'Different Angles', color: 'bg-purple-500' })
    if (selectedForVideo === imageId) badges.push({ label: 'Generate Video', color: 'bg-indigo-500' })
    if (selectedForAddAudio === imageId) badges.push({ label: 'Add Audio', color: 'bg-amber-500' })
    if (selectedForConvertTo3d === imageId) badges.push({ label: 'Convert to 3D', color: 'bg-teal-500' })
    if (selectedForClean === imageId) badges.push({ label: 'Clean', color: 'bg-cyan-500' })
    if (selectedBefore === imageId) badges.push({ label: 'Before', color: 'bg-blue-500' })
    if (selectedAfter === imageId) badges.push({ label: 'After', color: 'bg-green-500' })
    if (selectedForStaging === imageId) badges.push({ label: 'Staging', color: 'bg-orange-500' })
    if (selectedForAddItem === imageId) badges.push({ label: 'Add Item', color: 'bg-pink-500' })
    return badges
  }

  const getTypeLabel = (img: StoredImage) => {
    // Audio-generated items (video + hasAudio) show as "Audio" not "Video"
    if (img.type === 'video' && img.metadata?.hasAudio) return 'Audio'
    const type = img.type
    const labels = {
      original: 'Original',
      cleaned: 'Cleaned',
      staged: 'Staged',
      reference: 'Reference',
      added: 'Add Item',
      angled: 'Different Angles',
      video: 'Video',
      '3d-object': '3D Object',
      canva: 'Canva',
    }
    return labels[type]
  }

  return (
    <>
      <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden pb-2 min-w-0">
        {images.map((image) => {
          const badges = getBadges(image.id)

          return (
            <div
              key={image.id}
              className={`
                flex-shrink-0 w-20 h-20 rounded bg-white/5 border-2 overflow-hidden relative group
                ${selectedForView === image.id ? 'border-gray-500' : ''}
                ${selectedForDifferentAngles === image.id ? 'border-purple-500' : ''}
                ${selectedForVideo === image.id ? 'border-indigo-500' : ''}
                ${selectedForAddAudio === image.id ? 'border-amber-500' : ''}
                ${selectedForConvertTo3d === image.id ? 'border-teal-500' : ''}
                ${selectedForClean === image.id ? 'border-cyan-500' : ''}
                ${selectedBefore === image.id ? 'border-blue-500' : ''}
                ${selectedAfter === image.id ? 'border-green-500' : ''}
                ${selectedForStaging === image.id ? 'border-orange-500' : ''}
                ${selectedForAddItem === image.id ? 'border-pink-500' : ''}
                ${!badges.length ? 'border-white/10' : ''}
              `}
              onContextMenu={(e) => handleContextMenu(e, image.id)}
              onMouseEnter={(e) => {
                // Don't show preview if hovering over delete button
                const target = e.target as HTMLElement
                if (target.closest('button') || target.closest('[class*="bg-red"]')) {
                  return
                }
                // Clear any existing timeout
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current)
                }
                // Set preview after 2 seconds
                hoverTimeoutRef.current = setTimeout(() => {
                  setPreviewImage(image)
                  setIsPreviewVisible(true)
                }, 2000)
              }}
              onMouseLeave={() => {
                // Clear timeout if mouse leaves before 2 seconds
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current)
                  hoverTimeoutRef.current = null
                }
                // Immediately hide preview if it's visible
                if (isPreviewVisible && previewImage?.id === image.id) {
                  setIsPreviewVisible(false)
                  setPreviewImage(null)
                }
              }}
            >
              <img
                src={image.type === 'video' && image.sourceImageId 
                  ? (images.find(img => img.id === image.sourceImageId)?.url || image.url)
                  : image.url}
                alt={getTypeLabel(image)}
                className="w-full h-full"
                draggable={false}
              />
              
              {/* Badges */}
              <div className="absolute top-1 left-1 flex flex-col gap-1">
                {badges.map((badge, idx) => (
                  <span
                    key={idx}
                    className={`${badge.color} text-white text-[8px] px-1 py-0.5 rounded font-medium`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              {/* Type Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 text-center">
                {getTypeLabel(image)}
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Clear any pending preview timeout
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current)
                    hoverTimeoutRef.current = null
                  }
                  // Hide preview if visible
                  if (isPreviewVisible && previewImage?.id === image.id) {
                    setIsPreviewVisible(false)
                    setPreviewImage(null)
                  }
                  if (window.confirm('Are you sure you want to delete this image?')) {
                    onDelete(image.id)
                  }
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation()
                  // Clear timeout when hovering over delete button
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current)
                    hoverTimeoutRef.current = null
                  }
                  // Hide preview if visible
                  if (isPreviewVisible && previewImage?.id === image.id) {
                    setIsPreviewVisible(false)
                    setPreviewImage(null)
                  }
                }}
                className="absolute top-1 right-1 w-4 h-4 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            ref={contextMenuRef}
            className="fixed z-50 bg-black/90 border border-white/20 rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{ 
              left: `${contextMenu.x}px`, 
              top: `${contextMenu.y}px`,
            }}
          >
            <button
              onClick={() => handleContextAction('view')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Eye size={14} className="opacity-80" />
              View
            </button>

            {contextMenu.variant === 'restricted' && (() => {
              const img = images.find((i) => i.id === contextMenu.imageId)
              // Add Audio only for video without audio (not for items that already have audio)
              if (img?.type === 'video' && !img.metadata?.hasAudio) {
                return (
                  <>
                    <div className="border-t border-white/10 my-1" />
                    <button
                      onClick={() => handleContextAction('add-audio')}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                    >
                      <Music size={14} className="opacity-80" />
                      Add Audio
                    </button>
                  </>
                )
              }
              return null
            })()}

            {contextMenu.variant === 'full' && (
              <>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => handleContextAction('staging')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Sofa size={14} className="opacity-80" />
                  Use for Staging
                </button>
                <button
                  onClick={() => handleContextAction('clean')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Sparkles size={14} className="opacity-80" />
                  Use for Clean
                </button>
                <button
                  onClick={() => handleContextAction('add-item')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Plus size={14} className="opacity-80" />
                  Use for Add Item
                </button>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => handleContextAction('before')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <ArrowLeft size={14} className="opacity-80" />
                  Set as Before
                </button>
                <button
                  onClick={() => handleContextAction('after')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <ArrowRight size={14} className="opacity-80" />
                  Set as After
                </button>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => handleContextAction('view-angles')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Camera size={14} className="opacity-80" />
                  Set Different Angles
                </button>
                <button
                  onClick={() => handleContextAction('generate-video')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Video size={14} className="opacity-80" />
                  Set for Video Generation
                </button>
                <button
                  onClick={() => handleContextAction('convert-to-3d')}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                >
                  <Box size={14} className="opacity-80" />
                  Convert to 3D
                </button>
                {(() => {
                  const img = images.find((i) => i.id === contextMenu.imageId)
                  if (!img || img.type === 'video' || img.type === '3d-object') return null
                  return (
                    <>
                      <div className="border-t border-white/10 my-1" />
                      <button
                        onClick={() => handleContextAction('edit-in-canva')}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
                      >
                        <Edit3 size={14} className="opacity-80" />
                        Enable Edit in Canva
                      </button>
                    </>
                  )
                })()}
              </>
            )}

            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('download')}
              className="w-full px-3 py-2 text-left text-sm text-cyan-400 hover:bg-white/10 flex items-center gap-2"
            >
              <Download size={14} className="opacity-90" />
              Download
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('delete')}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
            >
              <Trash2 size={14} className="opacity-90" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Thumbnail Preview Modal */}
      <ThumbnailPreview
        image={previewImage}
        isVisible={isPreviewVisible}
        onClose={() => {
          setIsPreviewVisible(false)
          setPreviewImage(null)
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
          }
        }}
          selectedForClean={selectedForClean}
          selectedBefore={selectedBefore}
          selectedAfter={selectedAfter}
          selectedForStaging={selectedForStaging}
          selectedForAddItem={selectedForAddItem}
          selectedForView={selectedForView}
          selectedForDifferentAngles={selectedForDifferentAngles}
          selectedForVideo={selectedForVideo}
          selectedForConvertTo3d={selectedForConvertTo3d}
          selectedForAddAudio={selectedForAddAudio}
        />
    </>
  )
}

