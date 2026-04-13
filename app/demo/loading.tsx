import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-black text-white selection:bg-white/30 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-gradient-to-tr from-[#D6C5B3]/20 via-[#A38D7A]/15 to-[#6E5D4E]/20 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse" />

      {/* Loading Container */}
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-1000 delay-150 fill-mode-both">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full border border-white/10 bg-[#1c1c1e]/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <Loader2 className="w-8 h-8 text-[#D6C5B3] animate-spin opacity-90" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-xl font-medium tracking-tight text-white/90">
            Initializing Workspace
          </h3>
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-white/40">
            Connecting to secure context...
          </p>
        </div>
      </div>
    </div>
  )
}
