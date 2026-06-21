import { Wallet } from "lucide-react"

import { useAuth } from "@web/hooks/useAuth"
import { trpc } from "@web/trpc"

import Dashboard from "@web/components/Dashboard"
import AuthScreen from "@web/components/AuthScreen"
import OnboardingScreen from "@web/components/OnboardingScreen"
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
  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    enabled: !!session?.authenticated
  })

  if (isLoading) return <LoadingScreen />

  if (!session?.authenticated) return <AuthScreen />

  if (settingsQuery.isPending || !settingsQuery.data) return <LoadingScreen />

  if (!settingsQuery.data.onboarded) {
    return <OnboardingScreen onDone={() => settingsQuery.refetch()} />
  }

  return <Dashboard email={session.email} onLogout={handleLogout} />
}

export default App
