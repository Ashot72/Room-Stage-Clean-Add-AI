'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { loadAllImages, loadSelections, saveImage, saveSelections, getImageById } from '@/lib/imageStorage'

export default function CanvaReturnClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const correlationJwt = searchParams.get('correlation_jwt')
    if (!correlationJwt) {
      setStatus('error')
      setMessage('Missing correlation_jwt from Canva return URL.')
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const dedupeKey = `canva_return_${correlationJwt}`

    try {
      const already = sessionStorage.getItem(dedupeKey)
      if (already === 'done') {
        router.replace('/')
        return
      }
    } catch {
      // ignore
    }

    const run = async () => {
      setStatus('working')
      setMessage('Retrieving your Canva export…')

      // Get original image dimensions if stored
      const correlationStateFromJwt = correlationJwt ? (() => {
        try {
          const parts = correlationJwt.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            return payload.correlation_state || null
          }
        } catch {
          // Ignore
        }
        return null
      })() : null

      let imageDimensions: { width?: number; height?: number } | null = null
      let imageFormat: 'jpg' | 'png' | null = null
      if (correlationStateFromJwt) {
        try {
          const dimsStr = localStorage.getItem(`canva_dims_${correlationStateFromJwt}`)
          if (dimsStr) {
            imageDimensions = JSON.parse(dimsStr)
          }
          // Get source image URL to determine format
          const sourceImageId = localStorage.getItem(`canva_corr_${correlationStateFromJwt}`)
          if (sourceImageId) {
            const sourceImage = getImageById(sourceImageId)
            if (sourceImage?.url) {
              // Determine format from URL extension
              const urlLower = sourceImage.url.toLowerCase()
              if (urlLower.includes('.png') || urlLower.includes('image/png')) {
                imageFormat = 'png'
              } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('image/jpeg') || urlLower.includes('image/jpg')) {
                imageFormat = 'jpg'
              }
            }
          }
        } catch {
          // Ignore if dimensions/format not found or invalid
        }
      }

      try {
        const resp = await fetch('/api/canva/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            correlation_jwt: correlationJwt,
            return_to: `/canva/return?correlation_jwt=${encodeURIComponent(correlationJwt)}`,
            width: imageDimensions?.width,
            height: imageDimensions?.height,
            imageFormat: imageFormat || undefined,
          }),
        })

        const data = await resp.json().catch(() => ({}))
        if (resp.status === 401 && data?.authStartUrl) {
          window.location.href = data.authStartUrl
          return
        }

        if (!resp.ok || !data?.url) {
          throw new Error(data?.error || 'Failed to fetch Canva export.')
        }

        if (cancelled) return

        const correlationState: string | null = data.correlation_state || null
        const sourceImageId =
          correlationState ? localStorage.getItem(`canva_corr_${correlationState}`) : null

        // If we already saved this Canva export before (same design + correlation),
        // reuse it instead of creating a duplicate thumbnail.
        const existing = loadAllImages().find((img) => {
          if (img.type !== 'canva') return false
          if (img.metadata?.canvaDesignId !== data.designId) return false
          return img.metadata?.canvaCorrelationState === (correlationState || undefined)
        })

        const stored =
          existing ||
          saveImage({
            url: data.url,
            type: 'canva',
            sourceImageId: sourceImageId || undefined,
            metadata: {
              canvaDesignId: data.designId,
              canvaCorrelationState: correlationState || undefined,
            },
          })

        // Match the app's existing "Before/After" compare workflow:
        // - the image sent to Canva becomes "Before"
        // - the Canva edited image becomes the new "After"
        // (this enables split/slider view like other actions)
        const prev = loadSelections()
        saveSelections({
          ...prev,
          selectedBefore: sourceImageId || prev.selectedBefore,
          selectedAfter: stored.id, // keep for chaining edits
          // Clear action-mode selections so the UI lands in compare mode.
          selectedForClean: null,
          selectedForStaging: null,
          selectedForAddItem: null,
          selectedForDifferentAngles: null,
          selectedForVideo: null,
          selectedForConvertTo3d: null,
          // Ensure we land in compare mode, not "View".
          selectedForView: null,
        })

        if (cancelled) return

        try {
          sessionStorage.setItem(dedupeKey, 'done')
        } catch {
          // ignore
        }

        setMessage('Done. Redirecting…')
        router.replace('/')
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        if (cancelled) return
        setStatus('error')
        setMessage(e?.message || 'Failed to process Canva return.')
      }
    }

    run()

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen w-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-xl p-6">
        <h1 className="text-lg font-semibold">Returning from Canva</h1>
        <p className="text-sm text-white/70 mt-2">
          {status === 'working' ? 'Please wait while we import your edited image…' : null}
          {status === 'error' ? 'We could not finish importing your Canva edit.' : null}
        </p>
        {message && (
          <div
            className={`mt-4 text-sm rounded-lg px-3 py-2 ${
              status === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-white/5 text-white/80'
            }`}
          >
            {message}
          </div>
        )}
        {status === 'error' && (
          <button
            onClick={() => router.replace('/')}
            className="mt-4 w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-sm"
          >
            Back to app
          </button>
        )}
      </div>
    </main>
  )
}

