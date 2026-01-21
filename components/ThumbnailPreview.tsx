'use client'

import { StoredImage } from '@/lib/imageStorage'

interface ThumbnailPreviewProps {
  image: StoredImage | null
  isVisible: boolean
  onClose: () => void
  selectedForClean?: string | null
  selectedBefore?: string | null
  selectedAfter?: string | null
  selectedForStaging?: string | null
  selectedForAddItem?: string | null
  selectedForView?: string | null
  selectedForDifferentAngles?: string | null
  selectedForVideo?: string | null
  selectedForConvertTo3d?: string | null
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
  return labels[type] || 'Image'
}

export default function ThumbnailPreview({ 
  image, 
  isVisible, 
  onClose,
  selectedForClean,
  selectedBefore,
  selectedAfter,
  selectedForStaging,
  selectedForAddItem,
  selectedForView,
  selectedForDifferentAngles,
  selectedForVideo,
  selectedForConvertTo3d
}: ThumbnailPreviewProps) {
  if (!isVisible || !image) return null

  // Determine border color based on selection state
  let borderColor = 'border-white/20' // default
  if (selectedForView === image.id) {
    borderColor = 'border-gray-500'
  } else if (selectedForDifferentAngles === image.id) {
    borderColor = 'border-purple-500'
  } else if (selectedForVideo === image.id) {
    borderColor = 'border-indigo-500'
  } else if (selectedForConvertTo3d === image.id) {
    borderColor = 'border-teal-500'
  } else if (selectedForClean === image.id) {
    borderColor = 'border-cyan-500'
  } else if (selectedBefore === image.id) {
    borderColor = 'border-blue-500'
  } else if (selectedAfter === image.id) {
    borderColor = 'border-green-500'
  } else if (selectedForStaging === image.id) {
    borderColor = 'border-orange-500'
  } else if (selectedForAddItem === image.id) {
    borderColor = 'border-pink-500'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none backdrop-blur-sm bg-black/20"
      onMouseLeave={onClose}
    >
      <div 
        className="relative pointer-events-auto"
        onMouseLeave={onClose}
      >
        <div className={`w-[600px] h-[600px] border-2 ${borderColor} rounded-lg overflow-hidden shadow-2xl flex flex-col bg-black/60`}>
          <div className="flex-1 flex items-center justify-center overflow-hidden relative">
            <img
              src={image.url}
              alt={getTypeLabel(image.type)}
              className="w-full h-full"
            />
          </div>
          <div className="bg-black/60 px-4 py-2 border-t border-white/20 flex-shrink-0">
            <p className="text-white text-sm font-medium text-center">
              {getTypeLabel(image.type)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

