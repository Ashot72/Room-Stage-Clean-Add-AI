import 'server-only'

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const CANVA_TOKEN_COOKIE = 'canva_tokens'
export const CANVA_PKCE_COOKIE = 'canva_pkce'

export type CanvaTokens = {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in?: number
  expires_at: number // epoch ms
  scope?: string
}

// Cookie payload: keep it small and stable.
// We intentionally avoid storing the access token in the cookie because it can
// be very large and cause the browser to drop the cookie (leading to auth loops).
export type CanvaTokenCookie = {
  refresh_token: string
  scope?: string
}

export type CanvaPkceState = {
  code_verifier: string
  state: string
  return_to: string
  redirect_uri?: string
}

type CanvaPkceCookieMap = Record<string, CanvaPkceState>

type CanvaPkceMemoryState = CanvaPkceState & { expires_at: number }

declare global {
  // eslint-disable-next-line no-var
  var __canvaPkceMemory: Map<string, CanvaPkceMemoryState> | undefined
  // eslint-disable-next-line no-var
  var __canvaAccessMemory: Map<string, CanvaAccessMemoryEntry> | undefined
  // eslint-disable-next-line no-var
  var __canvaRefreshInFlight: Map<string, Promise<CanvaTokens>> | undefined
}

type CanvaAccessMemoryEntry = {
  access_token: string
  expires_at: number
  refresh_token: string
  scope?: string
  stored_at: number
}

function getPkceMemory() {
  if (!globalThis.__canvaPkceMemory) {
    globalThis.__canvaPkceMemory = new Map<string, CanvaPkceMemoryState>()
  }
  return globalThis.__canvaPkceMemory
}

function getAccessMemory() {
  if (!globalThis.__canvaAccessMemory) {
    globalThis.__canvaAccessMemory = new Map<string, CanvaAccessMemoryEntry>()
  }
  return globalThis.__canvaAccessMemory
}

function getRefreshInFlight() {
  if (!globalThis.__canvaRefreshInFlight) {
    globalThis.__canvaRefreshInFlight = new Map<string, Promise<CanvaTokens>>()
  }
  return globalThis.__canvaRefreshInFlight
}

export function storePkceInMemory(pkce: CanvaPkceState, ttlMs = 30 * 60 * 1000) {
  const mem = getPkceMemory()
  mem.set(pkce.state, { ...pkce, expires_at: Date.now() + ttlMs })
}

export function consumePkceFromMemory(state: string): CanvaPkceState | null {
  const mem = getPkceMemory()
  const entry = mem.get(state)
  if (!entry) return null
  mem.delete(state)
  if (entry.expires_at < Date.now()) return null
  const { expires_at: _expires, ...pkce } = entry
  return pkce
}

export function storeAccessTokenInMemory(tokens: CanvaTokens) {
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_at) return
  const mem = getAccessMemory()
  mem.set(tokens.refresh_token, {
    access_token: tokens.access_token,
    expires_at: tokens.expires_at,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    stored_at: Date.now(),
  })
}

function getCachedAccessToken(refresh_token: string): string | null {
  const mem = getAccessMemory()
  const entry = mem.get(refresh_token)
  if (!entry) return null
  // consider token expired if it will expire within the next minute
  if (entry.expires_at - Date.now() <= 60_000) return null
  return entry.access_token
}

async function refreshWithDedup(params: {
  refresh_token: string
  scope?: string
}): Promise<CanvaTokens> {
  const key = params.refresh_token
  const locks = getRefreshInFlight()
  const existing = locks.get(key)
  if (existing) return existing

  const p = refreshCanvaTokens(params).finally(() => {
    locks.delete(key)
  })
  locks.set(key, p)
  return p
}

export function getCanvaEnv() {
  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  const redirectUri = process.env.CANVA_REDIRECT_URI
  const rawScopes = process.env.CANVA_SCOPES?.trim()

  // Some environments (and dotenv) won't override an already-set process env var.
  // Also, our Canva flow requires asset upload + design creation, so ensure the
  // required scopes are always requested.
  const requiredScopes = [
    'design:content:write',
    'design:content:read',
    'asset:write',
    'asset:read',
  ]
  const scopeSet = new Set(
    (rawScopes && rawScopes.length > 0 ? rawScopes : requiredScopes.join(' '))
      .split(/\s+/)
      .filter(Boolean)
  )
  for (const s of requiredScopes) scopeSet.add(s)
  const scopes = Array.from(scopeSet).join(' ')

  if (!clientId) throw new Error('CANVA_CLIENT_ID is not configured')
  if (!clientSecret) throw new Error('CANVA_CLIENT_SECRET is not configured')
  if (!redirectUri) throw new Error('CANVA_REDIRECT_URI is not configured')

  return { clientId, clientSecret, redirectUri, scopes }
}

export function getCanvaPublicBaseUrl(): string {
  const explicit = process.env.CANVA_PUBLIC_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const redirectUri = process.env.CANVA_REDIRECT_URI
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin
    } catch {
      // ignore
    }
  }

  // last resort
  return ''
}

function parseSecretKeyBytes(secret: string): Buffer {
  const trimmed = secret.trim()
  // hex (32 bytes => 64 hex chars)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }
  // base64 / base64url (only accept if it decodes to 32 bytes)
  const b64 = Buffer.from(trimmed, 'base64')
  if (b64.length === 32) return b64

  // Derive a stable 32-byte key from any string
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest()
}

function getTokenKey(): Buffer {
  const raw = process.env.CANVA_TOKEN_SECRET
  if (!raw) throw new Error('CANVA_TOKEN_SECRET is not configured')
  const key = parseSecretKeyBytes(raw)
  return key
}

function base64urlEncode(buf: Buffer) {
  return buf.toString('base64url')
}

function base64urlDecode(s: string) {
  return Buffer.from(s, 'base64url')
}

export function encryptJson(obj: unknown): string {
  const key = getTokenKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${base64urlEncode(iv)}.${base64urlEncode(tag)}.${base64urlEncode(ciphertext)}`
}

export function decryptJson<T>(value: string): T | null {
  try {
    const [ivB64, tagB64, ctB64] = value.split('.')
    if (!ivB64 || !tagB64 || !ctB64) return null
    const key = getTokenKey()
    const iv = base64urlDecode(ivB64)
    const tag = base64urlDecode(tagB64)
    const ciphertext = base64urlDecode(ctB64)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(plaintext.toString('utf8')) as T
  } catch {
    return null
  }
}

function normalizeTokenCookie(value: any): CanvaTokenCookie | null {
  if (!value || typeof value !== 'object') return null
  const refresh = (value as any).refresh_token
  if (typeof refresh !== 'string' || refresh.length === 0) return null
  const scope = (value as any).scope
  return {
    refresh_token: refresh,
    scope: typeof scope === 'string' && scope.length > 0 ? scope : undefined,
  }
}

export function getTokensFromRequest(req: NextRequest): CanvaTokenCookie | null {
  const raw = req.cookies.get(CANVA_TOKEN_COOKIE)?.value
  if (!raw) return null
  const decoded = decryptJson<any>(raw)
  return normalizeTokenCookie(decoded)
}

export function setTokensCookie(res: NextResponse, tokens: CanvaTokens) {
  const secure = process.env.NODE_ENV === 'production'
  res.cookies.set({
    name: CANVA_TOKEN_COOKIE,
    value: encryptJson({
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
    } satisfies CanvaTokenCookie),
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    // keep refresh token around; access token is refreshed as needed
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

function decodePkceCookieValue(raw: string): any {
  // New format: base64url(JSON)
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    // Legacy format: raw JSON
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
}

function normalizePkceCookie(raw: string): CanvaPkceCookieMap {
  try {
    const parsed: any = decodePkceCookieValue(raw)
    if (!parsed) return {}
    // legacy single object
    if (parsed?.state && parsed?.code_verifier) {
      return { [String(parsed.state)]: parsed as CanvaPkceState }
    }
    // map form
    if (parsed && typeof parsed === 'object') {
      return parsed as CanvaPkceCookieMap
    }
  } catch {
    // ignore
  }
  return {}
}

export function getPkceMapFromRequest(req: NextRequest): CanvaPkceCookieMap {
  const raw = req.cookies.get(CANVA_PKCE_COOKIE)?.value
  if (!raw) return {}
  return normalizePkceCookie(raw)
}

export function setPkceCookie(res: NextResponse, pkce: CanvaPkceCookieMap) {
  const secure = process.env.NODE_ENV === 'production'
  // Store as base64url(JSON) so cookie value is RFC-safe (no quotes/braces)
  const encoded = Buffer.from(JSON.stringify(pkce), 'utf8').toString('base64url')
  res.cookies.set({
    name: CANVA_PKCE_COOKIE,
    value: encoded,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 30, // 30 minutes
  })
}

export function clearPkceCookie(res: NextResponse) {
  res.cookies.set({
    name: CANVA_PKCE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

function getBasicAuthHeader(clientId: string, clientSecret: string) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  return `Basic ${credentials}`
}

export async function exchangeAuthorizationCodeForTokens(params: {
  code: string
  code_verifier: string
  redirect_uri?: string
}): Promise<CanvaTokens> {
  const { clientId, clientSecret, redirectUri } = getCanvaEnv()
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', params.code)
  body.set('code_verifier', params.code_verifier)
  body.set('redirect_uri', params.redirect_uri || redirectUri)

  const resp = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json?.message || 'Failed to exchange authorization code')
  }

  const expiresIn = Number(json.expires_in || 0)
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    token_type: json.token_type,
    scope: json.scope,
    expires_in: expiresIn,
    expires_at: Date.now() + expiresIn * 1000,
  }
}

export async function refreshCanvaTokens(params: {
  refresh_token: string
  scope?: string
}): Promise<CanvaTokens> {
  const { clientId, clientSecret } = getCanvaEnv()
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refresh_token)
  if (params.scope) body.set('scope', params.scope)

  const resp = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(json?.message || 'Failed to refresh Canva access token')
  }

  const expiresIn = Number(json.expires_in || 0)
  return {
    access_token: json.access_token,
    // Some providers don't rotate refresh tokens on refresh.
    refresh_token: json.refresh_token || params.refresh_token,
    token_type: json.token_type,
    scope: json.scope,
    expires_in: expiresIn,
    expires_at: Date.now() + expiresIn * 1000,
  }
}

export async function getValidAccessTokenWithRefresh(
  req: NextRequest
): Promise<{ accessToken: string; updatedTokens?: CanvaTokens } | null> {
  const tokens = getTokensFromRequest(req)
  if (!tokens?.refresh_token) return null

  const cached = getCachedAccessToken(tokens.refresh_token)
  if (cached) return { accessToken: cached }

  try {
    const refreshed = await refreshWithDedup({
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
    })
    storeAccessTokenInMemory(refreshed)
    return { accessToken: refreshed.access_token, updatedTokens: refreshed }
  } catch {
    return null
  }
}

