'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
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
  onSetImageSelection: (type: 'clean' | 'before' | 'after' | 'staging' | 'add-item' | 'view' | 'different-angles' | 'video' | 'convert-to-3d', imageId: string) => void
  onDelete: (imageId: string) => void
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
  onSetImageSelection,
  onDelete,
}: GeneratedVersionsProps) {
  const [contextMenu, setContextMenu] = useState<{ imageId: string; x: number; y: number; openUp: boolean } | null>(null)
  const [previewImage, setPreviewImage] = useState<StoredImage | null>(null)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const handleContextMenu = (e: React.MouseEvent, imageId: string) => {
    e.preventDefault()
    
    // Calculate if menu should open upward
    // Menu has: View, separator, Clean, Staging, Add Item, separator, Before, After, separator, Different Angles, Video Generation, separator, Download, separator, Delete = ~420px
    const menuHeight = 420 // Approximate menu height in pixels (updated for all items)
    const viewportHeight = window.innerHeight
    const clickY = e.clientY
    const spaceBelow = viewportHeight - clickY
    const spaceAbove = clickY
    
    // Prefer opening upward if there's not enough space below, or if there's more space above
    const openUp = spaceBelow < menuHeight || (spaceAbove > spaceBelow && spaceAbove >= menuHeight)
    
    // Calculate top position: if opening up, position above click point
    let topPosition: number
    if (openUp) {
      topPosition = clickY - menuHeight + 20 // Move down by 20px
      // Ensure it doesn't go off the top of the screen
      if (topPosition < 10) {
        topPosition = 10 // Small margin from top
      }
    } else {
      topPosition = clickY + 20 // Move down by 20px
      // Ensure it doesn't go off the bottom of the screen
      if (topPosition + menuHeight > viewportHeight - 10) {
        topPosition = viewportHeight - menuHeight - 10 // Position above bottom with margin
      }
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
      openUp 
    })
  }

  const handleContextAction = (action: 'clean' | 'before' | 'after' | 'staging' | 'add-item' | 'view' | 'view-angles' | 'generate-video' | 'convert-to-3d' | 'download' | 'delete') => {
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
    if (selectedForView === imageId) badges.push({ label: 'View', color: 'bg-gray-500' })
    if (selectedForDifferentAngles === imageId) badges.push({ label: 'Different Angles', color: 'bg-purple-500' })
    if (selectedForVideo === imageId) badges.push({ label: 'Generate Video', color: 'bg-indigo-500' })
    if (selectedForConvertTo3d === imageId) badges.push({ label: 'Convert to 3D', color: 'bg-teal-500' })
    if (selectedForClean === imageId) badges.push({ label: 'Clean', color: 'bg-cyan-500' })
    if (selectedBefore === imageId) badges.push({ label: 'Before', color: 'bg-blue-500' })
    if (selectedAfter === imageId) badges.push({ label: 'After', color: 'bg-green-500' })
    if (selectedForStaging === imageId) badges.push({ label: 'Staging', color: 'bg-orange-500' })
    if (selectedForAddItem === imageId) badges.push({ label: 'Add Item', color: 'bg-pink-500' })
    return badges
  }

  const getTypeLabel = (type: StoredImage['type']) => {
    const labels = {
      original: 'Original',
      cleaned: 'Cleaned',
      staged: 'Staged',
      reference: 'Reference',
      added: 'Add Item',
      angled: 'Different Angles',
      video: 'Video',
      '3d-object': '3D Object',
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
                alt={getTypeLabel(image.type)}
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
                {getTypeLabel(image.type)}
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
            className="fixed z-50 bg-black/90 border border-white/20 rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{ 
              left: `${contextMenu.x}px`, 
              top: `${contextMenu.y}px`,
            }}
          >
            <button
              onClick={() => handleContextAction('view')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              View
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('staging')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Use for Staging
            </button>
            <button
              onClick={() => handleContextAction('clean')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Use for Clean
            </button>
            <button
              onClick={() => handleContextAction('add-item')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Use for Add Item
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('before')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Set as Before
            </button>
            <button
              onClick={() => handleContextAction('after')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Set as After
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('view-angles')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Set Different Angles
            </button>
            <button
              onClick={() => handleContextAction('generate-video')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Set for Video Generation
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('convert-to-3d')}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
            >
              Convert to 3D
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('download')}
              className="w-full px-3 py-2 text-left text-sm text-cyan-400 hover:bg-white/10"
            >
              Download
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleContextAction('delete')}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20"
            >
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
        />
    </>
  )
}

