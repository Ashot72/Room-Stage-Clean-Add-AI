import { Suspense } from 'react'

import CanvaLaunchClient from './CanvaLaunchClient'

export default function CanvaLaunchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen w-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-xl p-6">
            <h1 className="text-lg font-semibold">Opening Canva</h1>
            <p className="text-sm text-white/70 mt-2">Loading…</p>
          </div>
        </main>
      }
    >
      <CanvaLaunchClient />
    </Suspense>
  )
}

