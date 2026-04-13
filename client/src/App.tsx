import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { HoldingsPage } from '@/pages/HoldingsPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { MarketDataPage } from '@/pages/MarketDataPage'
import { InstrumentsPage } from '@/pages/InstrumentsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ChartPage } from '@/pages/ChartPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <span className="text-muted-foreground animate-pulse">Loading...</span>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/holdings"
            element={
              <RequireAuth>
                <HoldingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <OrdersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/market-data"
            element={
              <RequireAuth>
                <MarketDataPage />
              </RequireAuth>
            }
          />
          <Route
            path="/market-data/:id/chart"
            element={
              <RequireAuth>
                <ChartPage />
              </RequireAuth>
            }
          />
          <Route
            path="/instruments"
            element={
              <RequireAuth>
                <InstrumentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
