import { trpc } from "@web/trpc"

export function useAuth() {
  const { data: session, isLoading, refetch } = trpc.auth.session.useQuery()

  const handleLogout = async () => {
    // The session cookie is HttpOnly, so it must be cleared server-side.
    await fetch("/api/auth/logout", { method: "POST" })
    await refetch()
  }

  return { session, isLoading, handleLogout }
}
