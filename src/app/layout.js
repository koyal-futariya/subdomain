import './globals.css'
import { AuthProvider } from './context/AuthContext'

export const metadata = {
  title: 'Admin Blog System',
  description: 'Simple admin authentication for blog management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
