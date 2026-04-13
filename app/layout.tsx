import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import '@fontsource/manrope/latin.css'
import '@fontsource/ibm-plex-mono/latin.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'QueryLens — SME Cashflow Intelligence',
  description: 'Trust-first SME cashflow analysis over a built-in sample dataset, with Postgres facts, Mongo context, and evidence-first weekly investigation.',
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
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
