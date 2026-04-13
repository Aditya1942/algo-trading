import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { redirectToLogin } from '@/lib/api'

export function LoginPage() {
  const { status } = useAuth()
  const navigate = useNavigate()

  // Already authenticated → go home
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/dashboard', { replace: true })
    }
  }, [status, navigate])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            AT
          </div>
          <CardTitle className="text-2xl">Algo Trading</CardTitle>
          <CardDescription>
            Connect your Upstox account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={redirectToLogin}
            disabled={status === 'loading'}
          >
            <LogIn className="mr-2 size-4" />
            {status === 'loading' ? 'Checking...' : 'Login with Upstox'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
