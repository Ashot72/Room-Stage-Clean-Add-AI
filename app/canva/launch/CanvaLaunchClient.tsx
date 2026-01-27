'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { getImageById } from '@/lib/imageStorage'

export default function CanvaLaunchClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState<string>('Preparing Canva…')

  useEffect(() => {
    const corr = searchParams.get('corr')
    const src = searchParams.get('src')
    const imgUrlParam = searchParams.get('img')
    if (!corr) {
      setStatus('error')
      setMessage('Missing correlation state.')
      return
    }

    let sourceImageId = localStorage.getItem(`canva_corr_${corr}`)
    if (!sourceImageId && src) {
      // Recover mapping if localStorage was cleared
      sourceImageId = src
      localStorage.setItem(`canva_corr_${corr}`, src)
    }
    if (!sourceImageId) {
      setStatus('error')
      setMessage('Missing source image mapping for this Canva session. Please return to the app and click “Edit in Canva” again.')
      return
    }

    const img = getImageById(sourceImageId)
    const imageUrlToSend = img?.url || imgUrlParam
    if (!imageUrlToSend) {
      setStatus('error')
      setMessage('Could not find the source image to send to Canva.')
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      try {
        // Get original image dimensions to preserve them in export
        let imageWidth: number | undefined
        let imageHeight: number | undefined
        try {
          const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = imageUrlToSend
          })
          imageWidth = imgElement.naturalWidth
          imageHeight = imgElement.naturalHeight
          // Store dimensions with correlation state for later use
          if (imageWidth && imageHeight) {
            localStorage.setItem(
              `canva_dims_${corr}`,
              JSON.stringify({ width: imageWidth, height: imageHeight })
            )
          }
        } catch {
          // If we can't get dimensions, continue without them
        }

        setMessage('Opening Canva editor…')
        const returnTo = `/canva/launch?corr=${encodeURIComponent(corr)}${
          src ? `&src=${encodeURIComponent(src)}` : ''
        }${imgUrlParam ? `&img=${encodeURIComponent(imgUrlParam)}` : ''}`

        const resp = await fetch('/api/canva/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            imageUrl: imageUrlToSend,
            title: 'RoomForge AI',
            correlation_state: corr,
            return_to: returnTo,
          }),
        })

        const data = await resp.json().catch(() => ({}))
        if (resp.status === 401 && data?.authStartUrl) {
          window.location.href = data.authStartUrl
          return
        }

        if (!resp.ok || !data?.editUrl) {
          throw new Error(data?.error || 'Failed to open Canva.')
        }

        window.location.href = data.editUrl
      } catch (e: any) {
        // React StrictMode in dev intentionally mounts/unmounts twice; abort the
        // first request to avoid creating duplicate Canva import jobs.
        if (e?.name === 'AbortError') return
        if (cancelled) return
        setStatus('error')
        setMessage(e?.message || 'Failed to open Canva.')
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
        <h1 className="text-lg font-semibold">Opening Canva</h1>
        <p className="text-sm text-white/70 mt-2">
          {status === 'working' ? 'Please wait…' : 'We could not open Canva.'}
        </p>
        <div
          className={`mt-4 text-sm rounded-lg px-3 py-2 ${
            status === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-white/5 text-white/80'
          }`}
        >
          {message}
        </div>
      </div>
    </main>
  )
}

