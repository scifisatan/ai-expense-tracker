import React from "react";
import Dashboard from "./components/Dashboard";
import AuthScreen from "./components/AuthScreen";
import { trpc } from "./trpc";

export const App = () => {
  const { data: session, isLoading, refetch } = trpc.auth.session.useQuery();

  const handleLogin = async () => {
    await refetch();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refetch();
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  if (!session?.authenticated) return <AuthScreen onLogin={handleLogin} />;
  return <Dashboard chatId={session.chatId} onLogout={handleLogout} />;
};

export default App;

