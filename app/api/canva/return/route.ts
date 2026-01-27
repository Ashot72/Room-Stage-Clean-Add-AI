import { fal } from '@fal-ai/client'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'

import {
  getCanvaEnv,
  getCanvaPublicBaseUrl,
  getValidAccessTokenWithRefresh,
  setTokensCookie,
  type CanvaTokens,
} from '@/lib/canvaServer'

// Initialize fal.ai client with API key
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

type ReturnRequest = {
  correlation_jwt: string
  return_to?: string
  width?: number
  height?: number
  imageFormat?: 'jpg' | 'png' // Original image format to match export format
}

type CanvaReturnJwtPayload = JWTPayload & {
  type?: string
  design_id?: string
  correlation_state?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const canvaJwks = createRemoteJWKSet(new URL('https://api.canva.com/rest/v1/connect/keys'))

// Canva Return Navigation can be configured to hit either a frontend URL
// (recommended: `/canva/return`) or a backend URL.
// If the Canva developer portal is set to `/api/canva/return`, Canva will GET this route.
// Our actual import work is implemented as a POST, so on GET we redirect to the UI page
// which will POST the JWT and then navigate back to the app.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const correlationJwt = url.searchParams.get('correlation_jwt')

  const base = getCanvaPublicBaseUrl() || url.origin
  const dest = new URL('/canva/return', base)
  if (correlationJwt) dest.searchParams.set('correlation_jwt', correlationJwt)

  // Preserve optional return_to if present (useful for debugging / custom flows)
  const returnTo = url.searchParams.get('return_to')
  if (returnTo) dest.searchParams.set('return_to', returnTo)

  return NextResponse.redirect(dest, 307)
}

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: 'FAL_KEY is not configured. Please set it in .env.local' },
      { status: 500 }
    )
  }

  let body: ReturnRequest
  try {
    body = (await req.json()) as ReturnRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.correlation_jwt) {
    return NextResponse.json(
      { error: 'correlation_jwt is required' },
      { status: 400 }
    )
  }

  const tokenInfo = await getValidAccessTokenWithRefresh(req).catch(() => null)
  if (!tokenInfo?.accessToken) {
    const returnTo = body.return_to || '/canva/return'
    const base = getCanvaPublicBaseUrl()
    const authStartUrl = base
      ? new URL(
          `/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`,
          base
        ).toString()
      : `/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`
    return NextResponse.json(
      {
        error: 'Canva not connected',
        authStartUrl,
      },
      { status: 401 }
    )
  }

  const { clientId } = getCanvaEnv()

  let payload: CanvaReturnJwtPayload
  try {
    const verified = await jwtVerify<CanvaReturnJwtPayload>(
      body.correlation_jwt,
      canvaJwks,
      { audience: clientId }
    )
    payload = verified.payload
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Invalid correlation_jwt' },
      { status: 400 }
    )
  }

  if (payload.type !== 'rti') {
    return NextResponse.json({ error: 'Invalid return token type' }, { status: 400 })
  }

  const designId = payload.design_id
  const correlationState = payload.correlation_state

  if (!designId) {
    return NextResponse.json({ error: 'Missing design_id in return token' }, { status: 400 })
  }

  // Create export job with original dimensions if provided
  // Match the original image format (JPG or PNG)
  const exportFormat = body.imageFormat || 'jpg' // Default to JPG if format not detected
  const format: any = {
    type: exportFormat,
  }
  
  if (exportFormat === 'jpg') {
    format.quality = 95 // High quality JPEG (numeric value 95-100)
  } else if (exportFormat === 'png') {
    format.export_quality = 'pro' // Maximum quality PNG export (string 'pro' or 'regular')
  }
  
  if (body.width && body.height) {
    format.width = body.width
    format.height = body.height
  }

  const exportResp = await fetch('https://api.canva.com/rest/v1/exports', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      design_id: designId,
      format,
    }),
  })

  const exportJson: any = await exportResp.json().catch(() => ({}))
  if (!exportResp.ok) {
    return NextResponse.json(
      { error: exportJson?.message || 'Failed to start Canva export' },
      { status: 500 }
    )
  }

  const exportJobId = exportJson?.job?.id
  if (!exportJobId) {
    return NextResponse.json(
      { error: 'Canva export job did not return an id' },
      { status: 500 }
    )
  }

  // Poll export job status
  let finalExportJob: any = null
  for (let attempt = 0; attempt < 30; attempt++) {
    const statusResp = await fetch(
      `https://api.canva.com/rest/v1/exports/${encodeURIComponent(exportJobId)}`,
      { headers: { Authorization: `Bearer ${tokenInfo.accessToken}` } }
    )
    const statusJson: any = await statusResp.json().catch(() => ({}))
    if (!statusResp.ok) {
      return NextResponse.json(
        { error: statusJson?.message || 'Failed to check Canva export status' },
        { status: 500 }
      )
    }

    const status = statusJson?.job?.status
    if (status === 'success' || status === 'failed') {
      finalExportJob = statusJson?.job
      break
    }
    await sleep(1000)
  }

  if (!finalExportJob) {
    return NextResponse.json(
      { error: 'Timed out waiting for Canva export to complete' },
      { status: 504 }
    )
  }

  if (finalExportJob.status !== 'success') {
    return NextResponse.json(
      { error: finalExportJob?.error?.message || 'Canva export failed' },
      { status: 500 }
    )
  }

  const exportUrl: string | undefined = finalExportJob?.urls?.[0]
  if (!exportUrl) {
    return NextResponse.json(
      { error: 'Canva export completed but no URL was provided' },
      { status: 500 }
    )
  }

  // Download exported file and upload to fal.storage
  const fileResp = await fetch(exportUrl)
  if (!fileResp.ok) {
    return NextResponse.json(
      { error: `Failed to download Canva export (HTTP ${fileResp.status})` },
      { status: 502 }
    )
  }

  // Determine content type and extension based on export format
  const isPng = exportFormat === 'png'
  const contentType = fileResp.headers.get('content-type') || (isPng ? 'image/png' : 'image/jpeg')
  const bytes = new Uint8Array(await fileResp.arrayBuffer())
  const file = new File([bytes], `canva-export.${isPng ? 'png' : 'jpg'}`, { type: contentType })

  const falUrl = await fal.storage.upload(file)

  const res = NextResponse.json({
    url: falUrl,
    designId,
    correlation_state: correlationState || null,
  })

  if (tokenInfo.updatedTokens) {
    setTokensCookie(res, tokenInfo.updatedTokens as CanvaTokens)
  }

  return res
}

