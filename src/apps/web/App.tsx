import { Wallet } from "lucide-react"

import { useAuth } from "@web/hooks/useAuth"

import Dashboard from "@web/components/Dashboard"
import AuthScreen from "@web/components/AuthScreen"
import { Skeleton } from "@web/components/ui/skeleton"

const LoadingScreen = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
    <div className="flex size-12 animate-pulse items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <Wallet className="size-6" />
    </div>
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48" />
    </div>
  </div>
)

export const App = () => {
  const { session, isLoading, handleLogout } = useAuth()

  if (isLoading) return <LoadingScreen />

  if (!session?.authenticated) return <AuthScreen />

  return <Dashboard email={session.email} onLogout={handleLogout} />
}

export default App
