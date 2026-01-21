'use client'

import { Circle, X } from 'lucide-react'

interface PointPrompt {
  x: number
  y: number
  label: 0 | 1 // 0 = negative, 1 = positive
}

interface PointPromptAssistantProps {
  points: PointPrompt[]
  onPointsChange: (points: PointPrompt[]) => void
  onModeChange: (mode: 0 | 1) => void
  currentMode: 0 | 1
  isProcessing?: boolean
}

export default function PointPromptAssistant({
  points,
  onPointsChange,
  onModeChange,
  currentMode,
  isProcessing = false,
}: PointPromptAssistantProps) {
  const removePoint = (index: number) => {
    onPointsChange(points.filter((_, i) => i !== index))
  }

  const positivePoints = points.filter((p) => p.label === 1)
  const negativePoints = points.filter((p) => p.label === 0)

  return (
    <div className="w-80 bg-black/40 border-l border-white/10 flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">3D Conversion Assistant</h2>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mode Toggle */}
          <div>
            <h3 className="text-xs font-medium text-white/60 mb-3 uppercase tracking-wide">
              Point Mode
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => onModeChange(1)}
                className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  currentMode === 1
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Circle size={12} fill="currentColor" />
                  <span>Positive</span>
                </div>
              </button>
              <button
                onClick={() => onModeChange(0)}
                className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  currentMode === 0
                    ? 'bg-red-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Circle size={12} fill="currentColor" />
                  <span>Negative</span>
                </div>
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 leading-relaxed">
              Click on the main image to place {currentMode === 1 ? 'positive' : 'negative'} points.
            </p>
          </div>

          {/* Points Summary */}
          {points.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                Points ({points.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                  {positivePoints.length > 0 && (
                    <div>
                      <p className="text-xs text-green-400 mb-1">Positive ({positivePoints.length})</p>
                      <div className="space-y-1">
                        {positivePoints.map((point, index) => {
                          const pointIndex = points.indexOf(point)
                          return (
                            <div
                              key={pointIndex}
                              className="flex items-center justify-between bg-white/5 rounded px-2 py-1 text-xs"
                            >
                              <span className="text-white/80">
                                Point {index + 1}
                              </span>
                              <button
                                onClick={() => removePoint(pointIndex)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {negativePoints.length > 0 && (
                    <div>
                      <p className="text-xs text-red-400 mb-1">Negative ({negativePoints.length})</p>
                      <div className="space-y-1">
                        {negativePoints.map((point, index) => {
                          const pointIndex = points.indexOf(point)
                          return (
                            <div
                              key={pointIndex}
                              className="flex items-center justify-between bg-white/5 rounded px-2 py-1 text-xs"
                            >
                              <span className="text-white/80">
                                Point {index + 1}
                              </span>
                              <button
                                onClick={() => removePoint(pointIndex)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Info Section - at bottom */}
        <div className="pt-4 border-t border-white/10 p-4 pb-40">
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <p className="text-xs text-white/60 leading-relaxed">
              <strong>Positive points</strong> (green): Click on the object you want to convert to 3D.
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              <strong>Negative points</strong> (red): Click on unwanted elements (like blankets, clutter) to exclude them.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
