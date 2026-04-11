import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import '@fontsource/manrope/latin.css'
import '@fontsource/ibm-plex-mono/latin.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'QueryLens — SME Cashflow Intelligence',
  description: 'Trust-first SME cashflow analysis with seeded Postgres facts, Mongo context, and evidence-first weekly investigation.',
  generator: 'QueryLens',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
