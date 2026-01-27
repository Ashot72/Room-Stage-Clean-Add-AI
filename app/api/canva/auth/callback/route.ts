import { NextRequest, NextResponse } from 'next/server'

import {
  clearPkceCookie,
  consumePkceFromMemory,
  exchangeAuthorizationCodeForTokens,
  getCanvaPublicBaseUrl,
  getPkceMapFromRequest,
  setPkceCookie,
  setTokensCookie,
  storeAccessTokenInMemory,
} from '@/lib/canvaServer'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  if (error) {
    return NextResponse.json(
      { error: errorDescription || error },
      { status: 400 }
    )
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
  }

  if (!state) {
    return NextResponse.json(
      { error: 'Missing OAuth state. Please restart Canva sign-in.' },
      { status: 400 }
    )
  }

  const pkceMap = getPkceMapFromRequest(req)
  const pkce = pkceMap[state] || consumePkceFromMemory(state)
  if (!pkce?.code_verifier) {
    return NextResponse.json(
      { error: 'Missing PKCE verifier. Please restart Canva sign-in.' },
      { status: 400 }
    )
  }

  try {
    const tokens = await exchangeAuthorizationCodeForTokens({
      code,
      code_verifier: pkce.code_verifier,
      redirect_uri: pkce.redirect_uri,
    })

    const base = getCanvaPublicBaseUrl() || url.origin
    const res = NextResponse.redirect(new URL(pkce.return_to || '/', base))

    // Remove just this state entry; keep others if parallel auths exist
    if (pkceMap[state]) {
      delete pkceMap[state]
      if (Object.keys(pkceMap).length === 0) {
        clearPkceCookie(res)
      } else {
        setPkceCookie(res, pkceMap)
      }
    }

    // Cache access token for immediate post-auth usage (avoids refresh races in dev).
    storeAccessTokenInMemory(tokens)
    setTokensCookie(res, tokens)
    return res
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to complete Canva sign-in' },
      { status: 500 }
    )
  }
}

