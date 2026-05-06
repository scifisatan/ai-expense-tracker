import React from 'react';
import { useEffect, useState } from 'react';
import { type SessionResponse } from "./types"
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';

export const App = () => {
  const [session, setSession] = useState<SessionResponse>({ authenticated: false, chatId: null });

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then((d: SessionResponse) => setSession(d))
      .catch(() => { });
  }, []);

  const handleLogin = async () => {
    const res = await fetch('/api/auth/session');
    const data = await res.json() as SessionResponse;
    setSession(data);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession({ authenticated: false, chatId: null });
  };

  if (!session.authenticated) return <AuthScreen onLogin={handleLogin} />;
  return <Dashboard chatId={session.chatId} onLogout={handleLogout} />;
};

export default App;