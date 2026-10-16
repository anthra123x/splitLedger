import React from 'react';

export interface ScanningAnimationCardProps {
  fileName?: string;
  amountText?: string;
  stage: number; // 1: Lectura OCR, 2: Desglose partidas, 3: Balance fiscal
  statusMessage?: string;
  progressPercent?: number;
  onCancel?: () => void;
  onViewPreliminary?: () => void;
}

export default function ScanningAnimationCard({
  fileName = 'Factura.pdf',
  amountText,
  stage = 1,
  statusMessage,
  progressPercent = 35,
  onCancel,
  onViewPreliminary
}: ScanningAnimationCardProps) {
  // Compute default label if not passed
  const displayStatus = statusMessage || (
    stage === 1
      ? `Extrayendo texto y coordenadas OCR... ${progressPercent}%`
      : stage === 2
      ? `Descomponiendo partidas con SplitLLM... ${progressPercent}%`
      : `Verificando paridad fiscal y partida doble... ${progressPercent}%`
  );

  return (
    <section className="relative w-full rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-8 sm:p-12 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col items-center justify-center min-h-[380px] transition-all">
      {/* Subtle monochromatic ambient background glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-white/[0.03] rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* Precision monochrome central document with laser scan beam */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/10 rounded-2xl blur-xl animate-pulse-glow"></div>
          
          <div className="relative w-20 h-28 rounded-2xl bg-zinc-900 border border-zinc-800/90 shadow-2xl overflow-hidden flex flex-col items-center justify-between p-3 group">
            {/* Top header line simulating document header */}
            <div className="w-full flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
              <div className="w-3.5 h-1 rounded-full bg-zinc-600"></div>
              <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm"></div>
            </div>

            {/* Abstract lines simulating invoice items/breakdown */}
            <div className="w-full space-y-1.5 my-auto">
              <div className="w-full h-1 rounded-full bg-zinc-700/60"></div>
              <div className="w-4/5 h-1 rounded-full bg-zinc-800"></div>
              <div className="w-11/12 h-1 rounded-full bg-zinc-700/60"></div>
              <div className="w-3/5 h-1 rounded-full bg-zinc-800"></div>
            </div>

            {/* Bottom summary bar */}
            <div className="w-full pt-1.5 border-t border-zinc-800/80 flex items-center justify-between">
              <div className="w-5 h-1 rounded-full bg-zinc-400"></div>
              <div className="w-3 h-1 rounded-full bg-zinc-600"></div>
            </div>

            {/* Animated Laser Scan Beam */}
            <div className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent animate-scan-laser">
              <div className="h-0.5 bg-white shadow-[0_0_8px_#ffffff] w-full"></div>
            </div>
          </div>
        </div>

        {/* 3 Interconnected Monochromatic Pipeline Nodes */}
        <div className="w-full max-w-sm mb-7 relative px-4">
          {/* Base inactive connection line */}
          <div className="absolute top-1/2 left-8 right-8 h-px bg-zinc-800 -translate-y-1/2 z-0"></div>
          
          {/* Active filled connection line based on stage */}
          <div
            className="absolute top-1/2 left-8 h-px bg-zinc-500 -translate-y-1/2 z-0 transition-all duration-500"
            style={{
              width: stage === 1 ? '30%' : stage === 2 ? '68%' : '88%'
            }}
          ></div>

          <div className="relative z-10 flex items-center justify-between">
            {/* Step 1: Lectura OCR */}
            <div className="flex flex-col items-center gap-1.5">
              {stage > 1 ? (
                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-600 flex items-center justify-center text-white shadow-sm">
                  <span className="material-symbols-outlined text-[11px] font-bold">check</span>
                </div>
              ) : stage === 1 ? (
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-white opacity-40"></span>
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-white flex items-center justify-center text-white shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                </div>
              )}
              <span className={`text-[11px] font-medium transition-colors ${stage >= 1 ? 'text-zinc-200' : 'text-zinc-500'}`}>
                Lectura OCR
              </span>
            </div>

            {/* Step 2: Desglose partidas */}
            <div className="flex flex-col items-center gap-1.5">
              {stage > 2 ? (
                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-600 flex items-center justify-center text-white shadow-sm">
                  <span className="material-symbols-outlined text-[11px] font-bold">check</span>
                </div>
              ) : stage === 2 ? (
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-white opacity-40"></span>
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-white flex items-center justify-center text-white shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                </div>
              )}
              <span className={`text-[11px] font-medium transition-colors ${stage === 2 ? 'text-white' : stage > 2 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                Desglose partidas
              </span>
            </div>

            {/* Step 3: Balance fiscal */}
            <div className="flex flex-col items-center gap-1.5">
              {stage >= 3 ? (
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-white opacity-40"></span>
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-white flex items-center justify-center text-white shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  </div>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700/80 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
                </div>
              )}
              <span className={`text-[11px] transition-colors ${stage >= 3 ? 'text-white font-medium' : 'text-zinc-500 font-normal'}`}>
                Balance fiscal
              </span>
            </div>
          </div>
        </div>

        {/* State description, progress, and microdata */}
        <div className="text-center space-y-1.5 mb-5">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-sm sm:text-base font-medium text-zinc-100 tracking-tight">
              Analizando <span className="font-mono font-semibold text-white">{fileName}</span>
            </h3>
            {amountText && (
              <>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs text-zinc-400 font-mono">{amountText}</span>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            {displayStatus}
          </p>
        </div>

        {/* High precision monochromatic progress bar */}
        <div className="w-full max-w-xs h-1 rounded-full bg-zinc-900 border border-zinc-800/80 overflow-hidden mb-6">
          <div
            className="h-full bg-white rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
          ></div>
        </div>

        {/* Minimalist actions */}
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-full text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-zinc-800/90 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Cancelar</span>
            </button>
          )}

          {onViewPreliminary && (
            <button
              onClick={onViewPreliminary}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 bg-zinc-900/70 border border-zinc-700/60 transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              type="button"
            >
              <span>Ver desglose preliminar</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
