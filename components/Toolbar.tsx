'use client'

import { Sparkles, Sofa, Plus, Camera, Video, Box, Edit3, Music } from 'lucide-react'

interface ToolbarProps {
  onClean: () => void
  onAddItem: () => void
  onStage: () => void
  onDifferentAngles: () => void
  onGenerateVideo: () => void
  onConvertTo3D: () => void
  onEditInCanva: () => void
  onAddAudio: () => void
  canClean: boolean
  canAddItem: boolean
  canStage: boolean
  canDifferentAngles: boolean
  canGenerateVideo: boolean
  canConvertTo3D: boolean
  canEditInCanva: boolean
  canAddAudio: boolean
  loading?: boolean
}

export default function Toolbar({ 
  onClean,
  onAddItem,
  onStage,
  onDifferentAngles,
  onGenerateVideo,
  onConvertTo3D,
  onEditInCanva,
  onAddAudio,
  canClean,
  canAddItem,
  canStage,
  canDifferentAngles,
  canGenerateVideo,
  canConvertTo3D,
  canEditInCanva,
  canAddAudio,
  loading = false 
}: ToolbarProps) {
  const buttons = [
    {
      id: 'clean',
      label: 'Clean',
      icon: Sparkles,
      onClick: onClean,
      enabled: canClean && !loading,
    },
    {
      id: 'add-item',
      label: 'Add Item',
      icon: Plus,
      onClick: onAddItem,
      enabled: canAddItem && !loading,
    },
    {
      id: 'stage',
      label: 'Staging',
      icon: Sofa,
      onClick: onStage,
      enabled: canStage && !loading,
    },
    {
      id: 'different-angles',
      label: 'Different Angles',
      icon: Camera,
      onClick: onDifferentAngles,
      enabled: canDifferentAngles && !loading,
    },
    {
      id: 'generate-video',
      label: 'Generate Video',
      icon: Video,
      onClick: onGenerateVideo,
      enabled: canGenerateVideo && !loading,
    },
    {
      id: 'convert-to-3d',
      label: 'Convert to 3D',
      icon: Box,
      onClick: onConvertTo3D,
      enabled: canConvertTo3D && !loading,
    },
    {
      id: 'edit-in-canva',
      label: 'Edit in Canva',
      icon: Edit3,
      onClick: onEditInCanva,
      enabled: canEditInCanva && !loading,
    },
    {
      id: 'add-audio',
      label: 'Add Audio',
      icon: Music,
      onClick: onAddAudio,
      enabled: canAddAudio && !loading,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      {buttons.map((button) => {
        const Icon = button.icon
        return (
          <button
            key={button.id}
            onClick={button.onClick}
            disabled={!button.enabled}
            className={`
              w-14 h-14 rounded-full flex items-center justify-center
              transition-all duration-200
              ${button.enabled
                ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
              }
            `}
            title={button.label}
          >
            <Icon size={20} />
          </button>
        )
      })}
    </div>
  )
}

