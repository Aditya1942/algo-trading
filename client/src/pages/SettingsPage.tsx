import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/lib/auth'

export function SettingsPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell title="Settings">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Session and sign-in</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  )
}
