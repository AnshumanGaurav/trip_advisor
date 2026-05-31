import { Inter, Outfit } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata = {
  title: 'VoyageOptima | Smart Travel Route Date Optimizer',
  description: 'A premium, high-performance web application designed to find the absolute cheapest starting date for multi-leg journeys by modeling ticket fares, weekly fluctuations, stay-lengths, and transportation modes.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        {children}
      </body>
    </html>
  )
}
