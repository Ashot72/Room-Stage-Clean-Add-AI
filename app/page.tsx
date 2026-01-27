'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import ImageComparison from '@/components/ImageComparison'
import Toolbar from '@/components/Toolbar'
import CreativeAssistant from '@/components/CreativeAssistant'
import AngleAssistant from '@/components/AngleAssistant'
import PointPromptAssistant from '@/components/PointPromptAssistant'
import PointPlacementImage from '@/components/PointPlacementImage'
import ImageSelector from '@/components/ImageSelector'
import GeneratedVersions from '@/components/GeneratedVersions'
import VideoPlayer from '@/components/VideoPlayer'
import { Upload, X, Type, MousePointer2 } from 'lucide-react'
import { 
  uploadToFalStorage, 
  saveImage, 
  loadAllImages, 
  deleteImage, 
  getImageById,
  saveSelections,
  loadSelections,
  type StoredImage
} from '@/lib/imageStorage'

type PolygonPoint = {
  x: number
  y: number
}

type SelectionType = 'clean' | 'before' | 'after' | 'staging' | 'add-item' | 'view' | 'different-angles' | 'video' | 'convert-to-3d'
type ActionType = 'clean' | 'stage' | 'add-item' | 'different-angles' | 'generate-video' | 'convert-to-3d'

// Reusable Loading Overlay Component
const LoadingOverlay = () => (
  <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      <p className="text-white/80 text-sm">Processing...</p>
    </div>
  </div>
)

// Reusable Prompt Input Component
const PromptInput = ({ 
  label, 
  value, 
  onChange, 
  onClear, 
  placeholder, 
  onEnter 
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder: string
  onEnter?: () => void
}) => (
  <div className="px-6 py-3 border-b border-white/10 bg-black/20">
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-white/60 whitespace-nowrap">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
      />
      {value && (
        <button
          onClick={onClear}
          className="text-white/40 hover:text-white/60 text-xs px-2 flex items-center gap-1"
        >
          <X size={12} />
          <span>Clear</span>
        </button>
      )}
    </div>
  </div>
)

export default function Home() {
  // Grouped state
  const [storedImages, setStoredImages] = useState<StoredImage[]>([])
  const [selections, setSelections] = useState({
    before: null as string | null,
    after: null as string | null,
    clean: null as string | null,
    staging: null as string | null,
    addItem: null as string | null,
    view: null as string | null,
    differentAngles: null as string | null,
    video: null as string | null,
    convertTo3d: null as string | null,
  })
  const [prompts, setPrompts] = useState({
    clean: '',
    staging: '',
    addItem: '',
    video: '',
    convertTo3d: '',
  })
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    action: null as string | null,
    isUploading: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('matimalust')
  const [addItemMode, setAddItemMode] = useState<'prompt' | 'reference'>('prompt')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selection, setSelection] = useState<PolygonPoint[] | null>(null)
  const [sliderMode, setSliderMode] = useState(false)
  const [angleSettings, setAngleSettings] = useState({
    azimuth: 0,
    elevation: 0,
    distance: 5,
  })
  const [pointPrompts, setPointPrompts] = useState<Array<{x: number, y: number, label: 0|1}>>([])
  const [pointMode, setPointMode] = useState<0|1>(1) // 1 = positive, 0 = negative
  const [canvaSelectedImageId, setCanvaSelectedImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenceImageInputRef = useRef<HTMLInputElement>(null)

  // Helper function to get image URL
  const getImageUrl = (imageId: string | null): string | null => {
    if (!imageId) return null
    const image = getImageById(imageId)
    return image?.url || null
  }

  // Computed image URLs
  const imageUrls = useMemo(() => ({
    before: getImageUrl(selections.before),
    after: getImageUrl(selections.after),
    clean: getImageUrl(selections.clean),
    staging: getImageUrl(selections.staging),
    addItem: getImageUrl(selections.addItem),
    view: getImageUrl(selections.view),
    differentAngles: getImageUrl(selections.differentAngles),
    video: getImageUrl(selections.video),
    convertTo3d: getImageUrl(selections.convertTo3d),
  }), [selections, storedImages])

  const displayImageUrl = imageUrls.staging || imageUrls.addItem || imageUrls.clean || imageUrls.view || imageUrls.differentAngles || imageUrls.convertTo3d
  const isComparisonMode = !!selections.before

  // Helper to handle API response
  const handleAPIResponse = (action: ActionType, data: any, originalImageId: string, prompt?: string, selection?: PolygonPoint[] | null) => {
    if (action === 'generate-video') {
      // For videos, save with videoUrl and sourceImageId
      if (!data.videoUrl) {
        console.error('No videoUrl in response data:', data)
      }
      const storedImage = saveImage({
        url: data.imageUrl, // Original image URL
        type: 'video',
        videoUrl: data.videoUrl,
        sourceImageId: originalImageId,
        metadata: { prompt },
      })
      
      setStoredImages(prev => [storedImage, ...prev])
      
      // After video generation, switch to view mode to show the video
      // Clear video selection and set view selection instead
      setSelections(prev => ({
        ...prev,
        video: null, // Clear video generation selection
        view: storedImage.id, // Set to view mode to show the video
      }))
      
      // Save to localStorage
      saveSelections({
        selectedBefore: selections.before,
        selectedAfter: selections.after,
        selectedForClean: selections.clean,
        selectedForStaging: selections.staging,
        selectedForAddItem: selections.addItem,
        selectedForView: storedImage.id, // Set view to the generated video
        selectedForDifferentAngles: selections.differentAngles,
        selectedForVideo: null, // Clear video generation selection
        selectedForConvertTo3d: selections.convertTo3d,
      })
      
      // Clear video prompt
      setPrompts(prev => ({ ...prev, video: '' }))
    } else if (action === 'convert-to-3d') {
      // For 3D objects, save with glbUrl and sourceImageId (similar to video)
      if (!data.glbUrl) {
        console.error('No glbUrl in response data:', data)
      }
      const storedImage = saveImage({
        url: data.imageUrl, // Original image URL
        type: '3d-object',
        glbUrl: data.glbUrl,
        sourceImageId: originalImageId,
        metadata: { prompt },
      })
      
      setStoredImages(prev => [storedImage, ...prev])
      
      // After 3D generation, switch to view mode to show the 3D model
      // Clear convertTo3d selection and set view selection instead
      setSelections(prev => ({
        ...prev,
        convertTo3d: null, // Clear 3D conversion selection
        view: storedImage.id, // Set to view mode to show the 3D model
      }))
      
      // Save to localStorage
      saveSelections({
        selectedBefore: selections.before,
        selectedAfter: selections.after,
        selectedForClean: selections.clean,
        selectedForStaging: selections.staging,
        selectedForAddItem: selections.addItem,
        selectedForView: storedImage.id, // Set view to the generated 3D object
        selectedForDifferentAngles: selections.differentAngles,
        selectedForVideo: selections.video,
        selectedForConvertTo3d: null, // Clear 3D conversion selection
      })
      
      // Clear point prompts
      setPointPrompts([])
    } else {
      // For other actions, use the existing logic
      const typeMap: Record<Exclude<ActionType, 'generate-video' | 'convert-to-3d'>, 'cleaned' | 'staged' | 'added' | 'angled'> = {
        'clean': 'cleaned' as const,
        'stage': 'staged' as const,
        'add-item': 'added' as const,
        'different-angles': 'angled' as const,
      }
      
      const storedImage = saveImage({
        url: data.imageUrl,
        type: typeMap[action as Exclude<ActionType, 'generate-video' | 'convert-to-3d'>],
        metadata: { prompt, selection: selection || undefined },
      })
      
      setStoredImages(prev => [storedImage, ...prev])
      
      // Update selections: original becomes "Before", generated becomes "After"
      const selectionKey = action === 'clean' ? 'clean' : action === 'stage' ? 'staging' : action === 'add-item' ? 'addItem' : 'differentAngles'
      setSelections(prev => ({
        ...prev,
        before: originalImageId,
        after: storedImage.id,
        [selectionKey]: null,
      }))
      
      // Save to localStorage
      saveSelections({
        selectedBefore: originalImageId,
        selectedAfter: storedImage.id,
        selectedForClean: action === 'clean' ? null : selections.clean,
        selectedForStaging: action === 'stage' ? null : selections.staging,
        selectedForAddItem: action === 'add-item' ? null : selections.addItem,
        selectedForView: selections.view,
        selectedForDifferentAngles: action === 'different-angles' ? null : selections.differentAngles,
        selectedForVideo: selections.video,
        selectedForConvertTo3d: selections.convertTo3d,
      })
      
      // Clear prompt for add-item
      if (action === 'add-item') {
        setPrompts(prev => ({ ...prev, addItem: '' }))
      }
    }
  }

  // Initialize from localStorage
  useEffect(() => {
    const images = loadAllImages()
    setStoredImages(images)
    const savedSelections = loadSelections()
    
    const validateAndSet = (imageId: string | null, images: StoredImage[]) => {
      return imageId && images.find(img => img.id === imageId) ? imageId : null
    }
    
    setSelections({
      before: validateAndSet(savedSelections.selectedBefore, images),
      after: validateAndSet(savedSelections.selectedAfter, images),
      clean: validateAndSet(savedSelections.selectedForClean, images),
      staging: validateAndSet(savedSelections.selectedForStaging, images),
      addItem: validateAndSet(savedSelections.selectedForAddItem, images),
      view: validateAndSet(savedSelections.selectedForView, images),
      differentAngles: validateAndSet(savedSelections.selectedForDifferentAngles, images),
      video: validateAndSet(savedSelections.selectedForVideo, images),
      convertTo3d: validateAndSet(savedSelections.selectedForConvertTo3d, images),
    })
    
    // Auto-select first image as "View" if no selection exists
    if (images.length > 0 && 
        !savedSelections.selectedForView && 
        !savedSelections.selectedForClean && 
        !savedSelections.selectedForStaging && 
        !savedSelections.selectedForAddItem && 
        !savedSelections.selectedBefore) {
      setImageSelection('view', images[0].id)
    }
    
    // Restore selection mode if add item is selected
    if (savedSelections.selectedForAddItem && images.find(img => img.id === savedSelections.selectedForAddItem)) {
      setSelectionMode(true)
    }
  }, [])

  // Reset slider mode when before/after images change
  useEffect(() => {
    if (!selections.before || !selections.after) {
      setSliderMode(false)
    }
  }, [selections.before, selections.after])

  // Enable selection mode when Add Item or Clean is selected
  useEffect(() => {
    if (selections.addItem || selections.clean) {
      setSelectionMode(true)
    }
  }, [selections.addItem, selections.clean])

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoadingState({ isLoading: true, action: null, isUploading: true })
    setError(null)

    try {
      const url = await uploadToFalStorage(file)
      const storedImage = saveImage({ url, type: 'original' })
      setStoredImages(prev => [storedImage, ...prev])
      setImageSelection('view', storedImage.id)
    } catch (err: any) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setLoadingState({ isLoading: false, action: null, isUploading: false })
    }
  }

  // Reference image upload handler
  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Don't set isLoading for reference uploads to avoid double overlay
    setLoadingState({ isLoading: false, action: null, isUploading: true })
    setError(null)

    try {
      const url = await uploadToFalStorage(file)
      const storedImage = saveImage({ url, type: 'reference' })
      setStoredImages(prev => [storedImage, ...prev])
      setReferenceImageUrl(url)
    } catch (err: any) {
      setError(err.message || 'Failed to upload reference image')
    } finally {
      setLoadingState({ isLoading: false, action: null, isUploading: false })
    }
  }

  // API call handler
  const callAPI = async (
    action: ActionType, 
    imageUrl: string, 
    prompt?: string, 
    selection?: PolygonPoint[] | null, 
    referenceImageUrl?: string | null,
    angleParams?: { azimuth: number, elevation: number, distance: number },
    pointPrompts?: Array<{x: number, y: number, label: 0|1}>
  ) => {
    setLoadingState({ isLoading: true, action, isUploading: false })
    setError(null)

    try {
      const promptToUse = prompt || 
        (action === 'clean' ? prompts.clean : 
         action === 'add-item' ? prompts.addItem : 
         prompts.staging) || 
        selectedStyle

      const requestBody: any = {
        action,
        imageUrl,
        prompt: promptToUse,
        selection: selection || undefined,
        referenceImageUrl: referenceImageUrl || undefined,
      }

      // Add angle parameters for different-angles action
      if (action === 'different-angles' && angleParams) {
        requestBody.horizontal_angle = angleParams.azimuth
        requestBody.vertical_angle = angleParams.elevation
        requestBody.zoom = angleParams.distance
      }

      // Add point prompts for convert-to-3d action
      if (action === 'convert-to-3d' && pointPrompts) {
        requestBody.pointPrompts = pointPrompts
      }

      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process request')
      }

      const data = await response.json()
      const originalImageId = action === 'clean' ? selections.clean : 
                             action === 'stage' ? selections.staging : 
                             action === 'different-angles' ? selections.differentAngles :
                             action === 'generate-video' ? selections.video :
                             action === 'convert-to-3d' ? selections.convertTo3d :
                             selections.addItem

      if (originalImageId) {
        handleAPIResponse(action, data, originalImageId, prompt, selection)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoadingState({ isLoading: false, action: null, isUploading: false })
    }
  }

  // Action handlers
  const handleClean = () => {
    const imageToUse = selections.clean ? imageUrls.clean : null
    if (!imageToUse) {
      setError('Please select an image for cleaning first')
      return
    }
    if (selectionMode && !selection) {
      setError('Please select an area to remove first, or switch to prompt mode')
      return
    }
    callAPI('clean', imageToUse, prompts.clean, selection)
    setSelection(null)
    setSelectionMode(false)
  }

  const handleAddItem = () => {
    const imageToUse = selections.addItem ? imageUrls.addItem : null
    if (!imageToUse) {
      setError('Please select an image for adding items first')
      return
    }
    if (!selection || selection.length < 3) {
      setError('Please select an area using polygon selection first')
      return
    }
    if (!prompts.addItem.trim()) {
      setError('Please enter a prompt describing the item to add')
      return
    }
    if (addItemMode === 'reference' && !referenceImageUrl) {
      setError('Please upload a reference image or switch to prompt-only mode')
      return
    }
    callAPI('add-item', imageToUse, prompts.addItem, selection, referenceImageUrl)
    setSelection(null)
    setSelectionMode(false)
  }

  const handleStage = () => {
    const imageToUse = selections.staging ? imageUrls.staging : null
    if (!imageToUse) {
      setError('Please select an image for staging first')
      return
    }
    const prompt = prompts.staging || selectedStyle || 'modern'
    callAPI('stage', imageToUse, prompt)
  }

  const handleDifferentAngles = () => {
    const imageToUse = selections.differentAngles ? imageUrls.differentAngles : null
    if (!imageToUse) {
      setError('Please select an image for different angles first')
      return
    }
    callAPI('different-angles', imageToUse, undefined, undefined, undefined, angleSettings)
  }

  const handleGenerateVideo = () => {
    const imageToUse = selections.video ? imageUrls.video : null
    if (!imageToUse) {
      setError('Please select an image for video generation first')
      return
    }
    if (!prompts.video.trim()) {
      setError('Please enter a prompt describing the video motion/action')
      return
    }
    callAPI('generate-video', imageToUse, prompts.video)
  }

  // Delete image handler
  const handleDeleteImage = (imageId: string) => {
    const imageToDelete = getImageById(imageId)
    
    if (deleteImage(imageId)) {
      setStoredImages(prev => prev.filter(img => img.id !== imageId))
      
      if (imageToDelete && imageToDelete.url === referenceImageUrl) {
        setReferenceImageUrl(null)
      }
      
      // Clear selections if deleted image was selected
      const newSelections = {
        before: selections.before === imageId ? null : selections.before,
        after: selections.after === imageId ? null : selections.after,
        clean: selections.clean === imageId ? null : selections.clean,
        staging: selections.staging === imageId ? null : selections.staging,
        addItem: selections.addItem === imageId ? null : selections.addItem,
        view: selections.view === imageId ? null : selections.view,
        differentAngles: selections.differentAngles === imageId ? null : selections.differentAngles,
        video: selections.video === imageId ? null : selections.video,
        convertTo3d: selections.convertTo3d === imageId ? null : selections.convertTo3d,
      }
      
      setSelections(newSelections)
      saveSelections({
        selectedBefore: newSelections.before,
        selectedAfter: newSelections.after,
        selectedForClean: newSelections.clean,
        selectedForStaging: newSelections.staging,
        selectedForAddItem: newSelections.addItem,
        selectedForView: newSelections.view,
        selectedForDifferentAngles: newSelections.differentAngles,
        selectedForVideo: newSelections.video,
        selectedForConvertTo3d: newSelections.convertTo3d,
      })
    }
  }

  // Set image selection with state management
  const setImageSelection = (type: SelectionType, imageId: string) => {
    const currentState = selections.clean ? 'clean' : 
                         selections.staging ? 'staging' : 
                         selections.addItem ? 'add-item' : 
                         selections.view ? 'view' : 
                         selections.before ? 'before' :
                         selections.after ? 'after' :
                         selections.differentAngles ? 'different-angles' :
                         selections.video ? 'video' :
                         selections.convertTo3d ? 'convert-to-3d' :
                         null
    
    // Clear polygon when switching states
    if (currentState !== null && currentState !== type) {
      setSelection(null)
      setSelectionMode(type === 'add-item' || type === 'clean')
      
      // Clear prompts for the current state before switching
      if (currentState === 'clean') {
        setPrompts(prev => ({ ...prev, clean: '' }))
      } else if (currentState === 'staging') {
        setPrompts(prev => ({ ...prev, staging: '' }))
      } else if (currentState === 'add-item') {
        setPrompts(prev => ({ ...prev, addItem: '' }))
      } else if (currentState === 'video') {
        setPrompts(prev => ({ ...prev, video: '' }))
      } else if (currentState === 'convert-to-3d') {
        setPrompts(prev => ({ ...prev, convertTo3d: '' }))
        setPointPrompts([])
      }
    } else if (currentState !== null && currentState === type) {
      setSelection(null)
      if (type === 'convert-to-3d') {
        setPointPrompts([])
        setPrompts(prev => ({ ...prev, convertTo3d: '' }))
      }
    }
    
    // Create new selections object
    const newSelections = {
      before: type === 'before' ? imageId : (type === 'after' ? selections.before : null),
      after: type === 'after' ? imageId : (type === 'before' ? selections.after : null),
      clean: type === 'clean' ? imageId : null,
      staging: type === 'staging' ? imageId : null,
      addItem: type === 'add-item' ? imageId : null,
      view: type === 'view' ? imageId : null,
      differentAngles: type === 'different-angles' ? imageId : null,
      video: type === 'video' ? imageId : null,
      convertTo3d: type === 'convert-to-3d' ? imageId : null,
    }
    
    // Handle mutual exclusivity for before/after
    if (type === 'before' && selections.after === imageId) {
      newSelections.after = null
    }
    if (type === 'after' && selections.before === imageId) {
      newSelections.before = null
    }
    
    setSelections(newSelections)
    saveSelections({
      selectedBefore: newSelections.before,
      selectedAfter: newSelections.after,
      selectedForClean: newSelections.clean,
      selectedForStaging: newSelections.staging,
      selectedForAddItem: newSelections.addItem,
      selectedForView: newSelections.view,
      selectedForDifferentAngles: newSelections.differentAngles,
      selectedForVideo: newSelections.video,
      selectedForConvertTo3d: newSelections.convertTo3d,
    })
  }

  // Style and prompt handlers
  const handleStyleSelect = (style: string) => {
    setSelectedStyle(style)
    setPrompts(prev => ({ ...prev, staging: '' }))
  }

  const handlePromptChange = (prompt: string) => {
    setPrompts(prev => ({ ...prev, staging: prompt }))
    if (prompt) {
      setSelectedStyle('')
    }
  }

  // Validation helpers
  const canClean = !!selections.clean && (
    selectionMode 
      ? !!selection && selection.length >= 3
      : !!prompts.clean.trim()
  )
  const canAddItem = !!selections.addItem && !!selection && selection.length >= 3 && !!prompts.addItem.trim() && 
    (addItemMode === 'prompt' || (addItemMode === 'reference' && referenceImageUrl !== null))
  const canStage = !!selections.staging && !!prompts.staging.trim()
  const canDifferentAngles = !!selections.differentAngles
  const canGenerateVideo = !!selections.video && !!prompts.video.trim()
  const canConvertTo3D = !!selections.convertTo3d && pointPrompts.filter(p => p.label === 1).length > 0 && !!prompts.convertTo3d.trim()

  const canvaTargetImage = useMemo(() => {
    return canvaSelectedImageId ? getImageById(canvaSelectedImageId) : null
  }, [canvaSelectedImageId, storedImages])

  const canEditInCanva = !!(
    canvaSelectedImageId &&
    canvaTargetImage?.url &&
    canvaTargetImage.type !== 'video' &&
    canvaTargetImage.type !== '3d-object' &&
    selections.view === canvaSelectedImageId &&
    !selections.staging &&
    !selections.clean &&
    !selections.addItem &&
    !selections.differentAngles &&
    !selections.video &&
    !selections.convertTo3d
  )

  const generateCorrelationState = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as Crypto).randomUUID().replace(/-/g, '')
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  }

  const handleEnableCanvaEditing = (imageId: string) => {
    const image = getImageById(imageId)
    if (!image || image.type === 'video' || image.type === '3d-object') {
      setError('Please select an image (not video/3D) to edit in Canva')
      return
    }
    // Set the image to View mode (add to stage) like the View action
    setImageSelection('view', imageId)
    setCanvaSelectedImageId(imageId)
  }

  const handleEditInCanva = () => {
    if (!canvaTargetImage) {
      setError('Please select an image (not video/3D) to edit in Canva')
      return
    }

    try {
      const correlationState = generateCorrelationState()
      localStorage.setItem(`canva_corr_${correlationState}`, canvaTargetImage.id)
      const launchUrl = `/canva/launch?corr=${encodeURIComponent(correlationState)}&src=${encodeURIComponent(canvaTargetImage.id)}&img=${encodeURIComponent(canvaTargetImage.url)}`
      window.location.href = launchUrl
    } catch (e: any) {
      setError(e?.message || 'Failed to open Canva')
    }
  }

  const handleConvertTo3DClick = () => {
    if (!selections.convertTo3d) {
      // If no image is selected, find the first available image
      if (storedImages.length > 0) {
        setImageSelection('convert-to-3d', storedImages[0].id)
      } else {
        setError('Please upload an image first')
      }
    } else {
      // If image is already selected and points are placed, generate 3D model
      if (pointPrompts.filter(p => p.label === 1).length === 0) {
        setError('Please add at least one positive point on the object')
        return
      }
      const imageToUse = imageUrls.convertTo3d
      if (!imageToUse) {
        setError('Please select an image for 3D conversion first')
        return
      }
      const prompt = prompts.convertTo3d || 'object'
      callAPI('convert-to-3d', imageToUse, prompt, undefined, undefined, undefined, pointPrompts)
    }
  }

  return (
    <main className="h-screen w-screen flex bg-[#0a0a0a] text-white overflow-hidden">
      <Toolbar
        onClean={handleClean}
        onAddItem={handleAddItem}
        onStage={handleStage}
        onDifferentAngles={handleDifferentAngles}
        onGenerateVideo={handleGenerateVideo}
        onConvertTo3D={handleConvertTo3DClick}
        onEditInCanva={handleEditInCanva}
        canClean={canClean}
        canAddItem={canAddItem}
        canStage={canStage}
        canDifferentAngles={canDifferentAngles}
        canGenerateVideo={canGenerateVideo}
        canConvertTo3D={canConvertTo3D}
        canEditInCanva={canEditInCanva}
        loading={loadingState.isLoading}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className={`h-16 border-b border-white/10 flex items-center justify-between px-6 transition-all duration-300 ${selections.staging || selections.differentAngles || selections.convertTo3d ? 'pr-[340px]' : 'pr-6'}`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12H15V22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-sm font-semibold">RoomForge AI</h1>
          </div>
          {storedImages.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-white/10 text-white/60 hover:bg-white/15 flex items-center gap-2"
                title="Upload another image"
              >
                <Upload size={14} />
                <span>Upload</span>
              </button>
              {selections.clean && !selections.addItem && !selections.view && (
                <button
                  onClick={() => {
                    setSelectionMode(!selectionMode)
                    if (!selectionMode) {
                      setSelection(null)
                    }
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    selectionMode
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  {selectionMode ? (
                    <>
                      <MousePointer2 size={14} />
                      <span>Selection Mode</span>
                    </>
                  ) : (
                    <>
                      <Type size={14} />
                      <span>Prompt Mode</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </header>

        {displayImageUrl && !selectionMode && selections.clean && !selections.addItem && !selections.view && (
          <div className={`${selections.staging || selections.differentAngles || selections.convertTo3d ? 'pr-[340px]' : ''}`}>
            <PromptInput
              label="Remove objects:"
              value={prompts.clean}
              onChange={(value) => setPrompts(prev => ({ ...prev, clean: value }))}
              onClear={() => setPrompts(prev => ({ ...prev, clean: '' }))}
              placeholder="e.g., furniture, clutter, decor, or specific items..."
              onEnter={canClean ? handleClean : undefined}
            />
          </div>
        )}

        {displayImageUrl && selections.staging && !selections.clean && !selections.addItem && !selections.view && !selections.video && (
          <div className={`${selections.staging || selections.differentAngles || selections.convertTo3d ? 'pr-[340px]' : ''}`}>
            <PromptInput
              label="Staging style:"
              value={prompts.staging}
              onChange={handlePromptChange}
              onClear={() => setPrompts(prev => ({ ...prev, staging: '' }))}
              placeholder="e.g., modern, industrial, scandinavian, boho..."
              onEnter={canStage ? handleStage : undefined}
            />
          </div>
        )}

        {selections.video && !selections.clean && !selections.addItem && !selections.view && !selections.staging && !selections.convertTo3d && (
          <div className={`${selections.staging || selections.differentAngles || selections.convertTo3d ? 'pr-[340px]' : ''}`}>
            <PromptInput
              label="Video prompt:"
              value={prompts.video}
              onChange={(value) => setPrompts(prev => ({ ...prev, video: value }))}
              onClear={() => setPrompts(prev => ({ ...prev, video: '' }))}
              placeholder="e.g., room rotates 360 degrees, slow rotation showing all angles..."
              onEnter={canGenerateVideo ? handleGenerateVideo : undefined}
            />
          </div>
        )}

        {selections.convertTo3d && !selections.clean && !selections.addItem && !selections.view && !selections.staging && !selections.video && (
          <div className={`${selections.staging || selections.differentAngles || selections.convertTo3d ? 'pr-[340px]' : ''}`}>
            <PromptInput
              label="Object description:"
              value={prompts.convertTo3d}
              onChange={(value) => setPrompts(prev => ({ ...prev, convertTo3d: value }))}
              onClear={() => setPrompts(prev => ({ ...prev, convertTo3d: '' }))}
              placeholder="e.g., furniture, chair, object"
            />
          </div>
        )}

        {selections.addItem && imageUrls.addItem && (
          <div className="px-6 py-3 border-b border-white/10 bg-black/20 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/60 whitespace-nowrap">Mode:</span>
              <button
                onClick={() => {
                  setAddItemMode('prompt')
                  setReferenceImageUrl(null)
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  addItemMode === 'prompt'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                Prompt Only
              </button>
              <button
                onClick={() => setAddItemMode('reference')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  addItemMode === 'reference'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                Prompt + Reference
              </button>
              {addItemMode === 'reference' && (
                <div className="flex items-center gap-2 ml-2">
                  {referenceImageUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={referenceImageUrl}
                        alt="Reference"
                        className="w-8 h-8 object-cover rounded border border-white/20"
                        title="Reference image"
                      />
                      <button
                        onClick={() => {
                          const referenceImage = storedImages.find(img => img.url === referenceImageUrl && img.type === 'reference')
                          if (referenceImage) {
                            handleDeleteImage(referenceImage.id)
                          } else {
                            setReferenceImageUrl(null)
                          }
                        }}
                        className="text-white/40 hover:text-white/60 text-xs px-2 flex items-center gap-1"
                        title="Delete reference image"
                      >
                        <X size={12} />
                        <span>Clear</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => referenceImageInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      title="Upload reference image"
                    >
                      <Upload size={12} />
                      <span>Upload Reference</span>
                    </button>
                  )}
                  <input
                    ref={referenceImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            <PromptInput
              label="Add item:"
              value={prompts.addItem}
              onChange={(value) => setPrompts(prev => ({ ...prev, addItem: value }))}
              onClear={() => setPrompts(prev => ({ ...prev, addItem: '' }))}
              placeholder="e.g., a blue sofa, modern chair, coffee table..."
              onEnter={canAddItem ? handleAddItem : undefined}
            />
          </div>
        )}

        <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {isComparisonMode ? (
              <ImageComparison
                beforeImage={imageUrls.before}
                afterImage={imageUrls.after}
                loading={loadingState.isLoading}
                sliderMode={sliderMode && !!imageUrls.before && !!imageUrls.after}
                onToggleSlider={() => setSliderMode(!sliderMode)}
              />
            ) : selections.video && imageUrls.video ? (
              // Show image when selected for video generation (before video is generated)
              <div className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-black">
                {loadingState.isLoading && <LoadingOverlay />}
                <div className="flex justify-center">
                  <img
                    src={imageUrls.video}
                    alt="Image"
                    className="max-w-full h-auto object-contain"
                    style={{ display: 'block' }}
                  />
                </div>
              </div>
            ) : selections.view && imageUrls.view ? (
              // Display video player when viewing a video, or show image for regular view
              <div className="relative w-full h-full overflow-hidden bg-black">
                {loadingState.isLoading && <LoadingOverlay />}
                {(() => {
                  // Use getImageById to get the latest data from localStorage (not state)
                  const viewImage = selections.view ? getImageById(selections.view) : null
                  
                  // Check if this is a video type with a videoUrl
                  if (viewImage?.type === 'video' && viewImage?.videoUrl) {
                    // Show video player when viewing a generated video
                    const sourceImageUrl = viewImage?.sourceImageId 
                      ? getImageUrl(viewImage.sourceImageId) 
                      : imageUrls.view
                    return <VideoPlayer videoUrl={viewImage.videoUrl} sourceImageUrl={sourceImageUrl || undefined} />
                  } else if (viewImage?.type === '3d-object' && viewImage?.glbUrl) {
                    // Show 3D model viewer when viewing a 3D object
                    return (
                      <div className="relative w-full h-full overflow-hidden bg-neutral-900">
                        {/* @ts-ignore - model-viewer types not installed yet */}
                        <model-viewer
                          src={viewImage.glbUrl}
                          alt="3D Model"
                          camera-controls
                          auto-rotate
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    )
                  } else {
                    // Show image normally for regular view
                    return (
                      <div className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-black">
                        <div className="flex justify-center">
                          <img
                            src={imageUrls.view}
                            alt="Image"
                            className="max-w-full h-auto object-contain"
                            style={{ display: 'block' }}
                          />
                        </div>
                      </div>
                    )
                  }
                })()}
              </div>
            ) : displayImageUrl ? (
              <div className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-black">
                {loadingState.isLoading && <LoadingOverlay />}
                {selections.addItem && imageUrls.addItem ? (
                  // Polygon selection mode for add-item
                  <ImageSelector
                    imageUrl={imageUrls.addItem}
                    onSelectionChange={setSelection}
                    disabled={loadingState.isLoading}
                    showProcessButton={true}
                    onProcess={handleAddItem}
                    isProcessing={loadingState.isLoading && loadingState.action === 'add-item'}
                  />
                ) : selections.clean && imageUrls.clean && selectionMode ? (
                  // Polygon selection mode for clean
                  <ImageSelector
                    imageUrl={imageUrls.clean}
                    onSelectionChange={setSelection}
                    disabled={loadingState.isLoading}
                    showProcessButton={true}
                    onProcess={handleClean}
                    isProcessing={loadingState.isLoading && loadingState.action === 'clean'}
                  />
                ) : selections.convertTo3d ? (
                  // Point placement mode for 3D conversion
                  <div className="relative flex justify-center">
                    <PointPlacementImage
                      imageUrl={displayImageUrl}
                      points={pointPrompts}
                      onPointsChange={setPointPrompts}
                      currentMode={pointMode}
                    />
                  </div>
                ) : (
                  <div className="relative flex justify-center">
                    <img
                      src={displayImageUrl}
                      alt="Image"
                      className="max-w-full h-auto object-contain"
                      style={{ display: 'block' }}
                    />
                  </div>
                )}
              </div>
            ) : imageUrls.before ? (
              <div className="relative w-full h-full overflow-y-auto overflow-x-hidden bg-black">
                {loadingState.isLoading && <LoadingOverlay />}
                <div className="flex justify-center">
                  <img
                    src={imageUrls.before}
                    alt="Before"
                    className="max-w-full h-auto object-contain"
                    style={{ display: 'block' }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Only show upload overlay for main upload (when no image is displayed) */}
          {loadingState.isUploading && !displayImageUrl && !imageUrls.before && !selections.video && <LoadingOverlay />}

          {!displayImageUrl && !imageUrls.before && !selections.video && !loadingState.isLoading && !loadingState.isUploading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Upload size={20} />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded text-sm z-50">
              {error}
            </div>
          )}
        </div>

        <div className="h-32 border-t border-white/10 flex items-center px-6 gap-4 relative z-50 min-w-0 overflow-hidden">
          <span className="text-xs font-medium text-white/60 flex-shrink-0">Generated Versions</span>
          <div className="flex-1 min-w-0 overflow-hidden">
            <GeneratedVersions
            images={storedImages}
            selectedBefore={selections.before}
            selectedAfter={selections.after}
            selectedForClean={selections.clean}
            selectedForStaging={selections.staging}
            selectedForAddItem={selections.addItem}
            selectedForView={selections.view}
            selectedForDifferentAngles={selections.differentAngles}
            selectedForVideo={selections.video}
            selectedForConvertTo3d={selections.convertTo3d}
            onSetImageSelection={setImageSelection}
            onDelete={handleDeleteImage}
            onEnableCanvaEditing={handleEnableCanvaEditing}
          />
          </div>
        </div>
      </div>

      {/* Staging Assistant */}
      <div
        className={`
          fixed right-0 top-0 h-full z-40
          transition-all duration-300 ease-in-out
          ${selections.staging && !selections.differentAngles && !selections.convertTo3d
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
          }
        `}
      >
        <CreativeAssistant
          onStyleSelect={handleStyleSelect}
          onPromptChange={handlePromptChange}
          selectedStyle={selectedStyle}
          customPrompt={prompts.staging}
        />
      </div>

      {/* Angle Assistant */}
      <div
        className={`
          fixed right-0 top-0 h-full z-40
          transition-all duration-300 ease-in-out
          ${selections.differentAngles && !selections.convertTo3d
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
          }
        `}
      >
        <AngleAssistant
          onAngleChange={(azimuth, elevation, distance) => {
            setAngleSettings({ azimuth, elevation, distance })
          }}
          azimuth={angleSettings.azimuth}
          elevation={angleSettings.elevation}
          distance={angleSettings.distance}
        />
      </div>

      {/* Point Prompt Assistant */}
      <div
        className={`
          fixed right-0 top-0 h-full z-40
          transition-all duration-300 ease-in-out
          ${selections.convertTo3d
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
          }
        `}
      >
        <PointPromptAssistant
          points={pointPrompts}
          onPointsChange={setPointPrompts}
          onModeChange={setPointMode}
          currentMode={pointMode}
        />
      </div>
    </main>
  )
}
