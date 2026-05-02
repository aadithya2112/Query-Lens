import { SignIn } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function SignInPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/demo")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          QueryLens
        </Link>
        <SignIn
          path="/sign-in"
          routing="path"
          forceRedirectUrl="/demo"
          fallbackRedirectUrl="/demo"
        />
      </div>
    </main>
  )
}
