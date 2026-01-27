import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

import {
  getCanvaPublicBaseUrl,
  getValidAccessTokenWithRefresh,
  setTokensCookie,
  type CanvaTokens,
} from '@/lib/canvaServer'

type LaunchRequest = {
  imageUrl: string
  title?: string
  correlation_state?: string
  return_to?: string
}

type CanvaLaunchResult = { editUrl: string; designId: string; assetId: string }

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function base64(str: string) {
  return Buffer.from(str, 'utf8').toString('base64')
}

async function fetchAndNormalizeToJpegBytes(imageUrl: string): Promise<Uint8Array> {
  const upstream = await fetch(imageUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0',
    },
  })

  if (!upstream.ok) {
    throw new Error(`Failed to fetch source image (HTTP ${upstream.status})`)
  }

  const buf = new Uint8Array(await upstream.arrayBuffer())

  // Canva asset uploads accept many formats, but we normalize to a baseline JPEG
  // to maximize compatibility and strip any tricky metadata.
  const jpegBytes = await sharp(buf, { failOnError: false })
    .rotate() // normalize orientation if present
    .jpeg({
      quality: 92,
      mozjpeg: false,
      progressive: false,
      chromaSubsampling: '4:2:0',
    })
    .toBuffer()

  return new Uint8Array(jpegBytes)
}

async function createAssetUploadJob(params: {
  accessToken: string
  name: string
  bytes: Uint8Array
}) {
  const resp = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/octet-stream',
      // OpenAPI says this header is JSON.
      'Asset-Upload-Metadata': JSON.stringify({ name_base64: base64(params.name) }),
    },
    body: Buffer.from(params.bytes),
  })

  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const bodyText = typeof json?.body === 'string' ? json.body : ''
    const msg = json?.message || bodyText || 'Failed to upload asset to Canva'
    const code =
      json?.code || (bodyText && /missing scopes/i.test(bodyText) ? 'missing_scope' : undefined)
    const err = new Error(msg) as Error & { code?: string; canva?: any }
    err.code = code
    err.canva = json
    throw err
  }

  const jobId = json?.job?.id
  if (!jobId) throw new Error('Canva asset upload did not return a job id')
  return { jobId }
}

async function pollAssetUploadJob(params: { accessToken: string; jobId: string }) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const resp = await fetch(
      `https://api.canva.com/rest/v1/asset-uploads/${encodeURIComponent(params.jobId)}`,
      { headers: { Authorization: `Bearer ${params.accessToken}` } }
    )
    const json: any = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const msg = json?.message || 'Failed to check Canva asset upload status'
      const code = json?.code
      const err = new Error(msg) as Error & { code?: string; canva?: any }
      err.code = code
      err.canva = json
      throw err
    }

    const status = json?.job?.status
    if (status === 'success') {
      const assetId = json?.job?.asset?.id
      if (!assetId) throw new Error('Canva asset upload succeeded but returned no asset id')
      return { assetId }
    }

    if (status === 'failed') {
      const code = json?.job?.error?.code
      const message = json?.job?.error?.message || 'Canva asset upload failed'
      const err = new Error(message) as Error & { code?: string; canva?: any }
      err.code = code
      err.canva = json?.job
      throw err
    }

    await sleep(1000)
  }

  throw new Error('Timed out waiting for Canva asset upload to complete')
}

async function createDesignWithAsset(params: {
  accessToken: string
  title: string
  assetId: string
  correlation_state?: string
}): Promise<{ designId: string; editUrl: string }> {
  const resp = await fetch('https://api.canva.com/rest/v1/designs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: params.title,
      asset_id: params.assetId,
    }),
  })

  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = json?.message || 'Failed to create Canva design'
    const code = json?.code
    const err = new Error(msg) as Error & { code?: string; canva?: any }
    err.code = code
    err.canva = json
    throw err
  }

  const designId = json?.design?.id
  const editUrlRaw = json?.design?.urls?.edit_url
  if (!designId || !editUrlRaw) throw new Error('Canva createDesign did not return an edit_url')

  const editUrl = new URL(editUrlRaw)
  if (params.correlation_state) {
    editUrl.searchParams.set('correlation_state', params.correlation_state)
  }
  return { designId, editUrl: editUrl.toString() }
}

export async function POST(req: NextRequest) {
  let body: LaunchRequest
  try {
    body = (await req.json()) as LaunchRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  const tokenInfo = await getValidAccessTokenWithRefresh(req).catch(() => null)
  if (!tokenInfo?.accessToken) {
    const returnTo = body.return_to || '/'
    const base = getCanvaPublicBaseUrl()
    const authStartUrl = base
      ? new URL(`/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`, base).toString()
      : `/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`
    return NextResponse.json({ error: 'Canva not connected', authStartUrl }, { status: 401 })
  }

  const title = body.title || 'RoomForge AI Edit'
  const assetName = 'RoomForge AI Image'

  try {
    const jpegBytes = await fetchAndNormalizeToJpegBytes(body.imageUrl)
    const { jobId } = await createAssetUploadJob({
      accessToken: tokenInfo.accessToken,
      name: assetName,
      bytes: jpegBytes,
    })

    const { assetId } = await pollAssetUploadJob({
      accessToken: tokenInfo.accessToken,
      jobId,
    })

    const { designId, editUrl } = await createDesignWithAsset({
      accessToken: tokenInfo.accessToken,
      title,
      assetId,
      correlation_state: body.correlation_state,
    })

    const result: CanvaLaunchResult = { editUrl, designId, assetId }
    const res = NextResponse.json(result)
    if (tokenInfo.updatedTokens) setTokensCookie(res, tokenInfo.updatedTokens as CanvaTokens)
    return res
  } catch (e: any) {
    // If we know it's an auth/scope issue, return a helpful response.
    const code = e?.code
    const message = e?.message || 'Failed to launch Canva'
    const canva = e?.canva
    const status =
      code === 'invalid_access_token' || code === 'revoked_access_token' || code === 'missing_scope'
        ? 401
        : 500
    if (status === 401) {
      const returnTo = body.return_to || '/'
      const base = getCanvaPublicBaseUrl()
      const authStartUrl = base
        ? new URL(`/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`, base).toString()
        : `/api/canva/auth/start?return_to=${encodeURIComponent(returnTo)}`
      return NextResponse.json({ error: message, code, canva, authStartUrl }, { status })
    }
    return NextResponse.json({ error: message, code, canva }, { status })
  }
}

