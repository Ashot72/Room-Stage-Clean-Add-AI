import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { getCanvaEnv, getPkceMapFromRequest, setPkceCookie, storePkceInMemory, type CanvaPkceState } from '@/lib/canvaServer'

export async function GET(req: NextRequest) {
  const { clientId, redirectUri, scopes } = getCanvaEnv()

  const url = new URL(req.url)
  const returnTo = url.searchParams.get('return_to') || '/'

  const codeVerifier = crypto.randomBytes(96).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  const state = crypto.randomBytes(32).toString('base64url')

  const pkce: CanvaPkceState = {
    code_verifier: codeVerifier,
    state,
    return_to: returnTo,
    // store the redirect URI used for this flow so callback can exchange consistently
    redirect_uri: redirectUri,
  }

  const authorizeUrl = new URL('https://www.canva.com/api/oauth/authorize')
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 's256')
  authorizeUrl.searchParams.set('scope', scopes)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)

  const res = NextResponse.redirect(authorizeUrl.toString())

  // Store PKCE data in a map keyed by state to avoid overwriting when multiple
  // auth attempts happen in parallel (common with multiple tabs).
  const map = getPkceMapFromRequest(req)
  map[state] = pkce
  setPkceCookie(res, map)

  // Server-side fallback (dev-friendly): keeps working even if cookies are blocked.
  storePkceInMemory(pkce)
  return res
}

