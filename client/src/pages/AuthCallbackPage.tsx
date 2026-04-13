import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [state, setState] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (error) {
      queueMicrotask(() => {
        setState('error')
        setErrorMsg(error)
      })
      return
    }

    // Callback page loaded after server handled /auth/callback
    // If we got here, check if auth worked by refreshing auth state
    queueMicrotask(() => {
      if (success === 'true') {
        setState('success')
        refresh()
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
      } else {
        refresh()
        setState('success')
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
      }
    })
  }, [searchParams, navigate, refresh])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {state === 'loading' && (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
              <CardTitle>Authenticating...</CardTitle>
              <CardDescription>
                Completing Upstox OAuth handshake
              </CardDescription>
            </>
          )}
          {state === 'success' && (
            <>
              <CheckCircle2 className="mx-auto size-10 text-green-500" />
              <CardTitle>Connected!</CardTitle>
              <CardDescription>Redirecting to dashboard...</CardDescription>
            </>
          )}
          {state === 'error' && (
            <>
              <XCircle className="mx-auto size-10 text-destructive" />
              <CardTitle>Authentication Failed</CardTitle>
              <CardDescription>{errorMsg || 'Unknown error'}</CardDescription>
            </>
          )}
        </CardHeader>
        {state === 'error' && (
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate('/login', { replace: true })}
            >
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
