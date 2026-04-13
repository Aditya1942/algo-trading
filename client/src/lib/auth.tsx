import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/lib/api'
import { upstoxKeys } from '@/lib/upstox-query-keys'
import {
  useLogoutMutation,
  useUpstoxProfileQuery,
} from '@/lib/upstox-queries'

interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  user: UserProfile | null
  refresh: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  status: 'loading',
  user: null,
  refresh: () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const profileQuery = useUpstoxProfileQuery()
  const logoutMutation = useLogoutMutation()

  const status = useMemo((): AuthState['status'] => {
    if (profileQuery.isPending) return 'loading'
    if (profileQuery.isError) return 'unauthenticated'
    if (profileQuery.data) return 'authenticated'
    return 'unauthenticated'
  }, [profileQuery.isPending, profileQuery.isError, profileQuery.data])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: upstoxKeys.all })
  }, [queryClient])

  const signOut = useCallback(async () => {
    await logoutMutation.mutateAsync()
  }, [logoutMutation])

  const value = useMemo(
    () => ({
      status,
      user: profileQuery.data ?? null,
      refresh,
      signOut,
    }),
    [status, profileQuery.data, refresh, signOut],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
