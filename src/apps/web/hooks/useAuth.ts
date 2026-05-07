import { trpc } from "@web/trpc"

export function useAuth() {
  const { data: session, isLoading, refetch } = trpc.auth.session.useQuery()
  const logoutMutation = trpc.auth.logout.useMutation()

  const handleLogin = async () => {
    await refetch()
  }

  const handleLogout = async () => {
    await logoutMutation.mutateAsync()
    document.cookie = "budget_session=; path=/; max-age=0; SameSite=Lax"
    await refetch()
  }

  return { session, isLoading, handleLogin, handleLogout }
}
