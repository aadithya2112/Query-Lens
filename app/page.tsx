import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
            Query Lens
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            An intelligent workspace for exploring data, generating actionable
            insights, and seamlessly analyzing your metrics.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link href="/demo">Launch Workspace</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="h-12 px-8 text-base"
            >
              <Link href="/explorer">Explorer View</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
            >
              <a
                href="https://github.com/aadithya2112/Query-Lens"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
