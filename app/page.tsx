import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import previewImg from "./images/landing-page-preview.png"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-hidden selection:bg-white/30">
      {/* Apple-style floating nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 animate-in slide-in-from-top-12 duration-1000">
        <div className="flex items-center gap-8 px-8 py-3 rounded-full bg-[#1c1c1e]/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <Link href="/" className="font-semibold text-sm tracking-wide text-white/90 hover:text-white transition-colors">QueryLens</Link>
          <Link href="/demo" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Workspace</Link>
          <Link href="/explorer" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Context</Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center relative pt-32 pb-20 px-6 sm:px-12 text-center isolate">

        {/* Glow behind text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-[#D6C5B3]/25 via-[#A38D7A]/20 to-[#6E5D4E]/30 blur-[130px] rounded-[100%] pointer-events-none -z-10" />

        <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur-md mb-8 text-white/70 animate-in fade-in slide-in-from-bottom-4 duration-700 hover:bg-white/10 transition-colors cursor-default">
          Introducing QueryLens
        </div>

        <h1 className="text-6xl sm:text-7xl lg:text-[110px] font-semibold tracking-[-0.04em] leading-[1.05] animate-in fade-in slide-in-from-bottom-6 duration-1000">
          Talk to Data. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FDFBF7] via-[#D6C5B3] to-[#A38D7A]">
            Brilliantly simple.
          </span>
        </h1>

        <p className="mt-10 text-xl sm:text-2xl text-[#86868b] max-w-2xl mx-auto font-medium tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
          The ultimate intelligent workspace. Ask questions, explore insights, and uncover metrics beautifully.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          <Button asChild size="lg" className="h-14 px-8 text-base bg-white text-black hover:bg-white/90 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_4px_24px_rgba(255,255,255,0.25)]">
            <Link href="/demo">Launch Workspace</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 px-8 text-base rounded-full font-semibold border-white/20 bg-[#1c1c1e]/40 text-white hover:bg-white/10 transition-all hover:scale-105 active:scale-95 backdrop-blur-xl"
          >
            <Link href="/explorer">View Source Context</Link>
          </Button>
        </div>

        {/* Mockup / Image area to ground the layout */}
        <div className="w-full max-w-7xl mt-24 rounded-[32px] border border-white/10 bg-[#09090b] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 flex flex-col">
          <div className="h-14 shrink-0 border-b border-white/5 bg-[#18181b] flex items-center px-6 gap-2 z-10 box-border">
            <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] border border-black/10"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] border border-black/10"></div>
            <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f] border border-black/10"></div>
          </div>
          <div className="w-full overflow-hidden">
            <Image 
              src={previewImg} 
              alt="QueryLens Workspace Preview" 
              quality={100}
              className="w-full h-auto block"
              priority
            />
          </div>
        </div>

      </main>
    </div>
  )
}
