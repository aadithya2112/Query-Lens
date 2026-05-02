import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import '@fontsource/manrope/latin.css'
import '@fontsource/ibm-plex-mono/latin.css'
import './globals.css'
import ConvexClientProvider from '@/components/convex-client-provider'

export const metadata: Metadata = {
  title: 'QueryLens — SME Cashflow Intelligence',
  description: 'Trust-first SME cashflow analysis over Postgres facts, Mongo context, and evidence-first weekly investigation.',
  generator: 'QueryLens',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <ClerkProvider
          signInUrl="/sign-in"
          signInFallbackRedirectUrl="/demo"
          signUpFallbackRedirectUrl="/demo"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
