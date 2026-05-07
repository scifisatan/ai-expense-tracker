import { useAuth } from "@web/hooks/useAuth"

import Dashboard from "@web/components/Dashboard"
import AuthScreen from "@web/components/AuthScreen"

export const App = () => {
  const { session, isLoading, handleLogin, handleLogout } = useAuth()

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>

  if (!session?.authenticated) return <AuthScreen onLogin={handleLogin} />

  return <Dashboard chatId={session.chatId} onLogout={handleLogout} />
}

export default App
