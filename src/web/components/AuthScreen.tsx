import { FormEvent, useState } from "react";

const AuthScreen = ({
  onLogin,
}: {
  onLogin: () => void;
}) => {
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setStatus(''); setIsError(false);
    try {
      const payload: { username?: string; chatId?: number } = {};
      if (/^\d+$/.test(identifier)) {
        payload.chatId = Number(identifier);
      } else {
        payload.username = identifier.replace(/^@/, '');
      }

      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { challengeToken?: string; error?: string };
      if (!res.ok || !data.challengeToken) { setStatus(data.error ?? 'Failed to send OTP.'); setIsError(true); return; }
      setChallengeToken(data.challengeToken);
      setStatus('OTP sent to your Telegram. Enter it below.');
    } catch { setStatus('Network error.'); setIsError(true); } finally { setLoading(false); }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setLoading(true); setStatus(''); setIsError(false);
    try {
      const payload: { username?: string; chatId?: number; otp: string; challengeToken: string } = {
        otp: otp.trim(),
        challengeToken
      };
      if (/^\d+$/.test(identifier)) {
        payload.chatId = Number(identifier);
      } else {
        payload.username = identifier.replace(/^@/, '');
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setStatus(data.error ?? 'Verification failed.'); setIsError(true); return; }
      onLogin();
    } catch { setStatus('Network error.'); setIsError(true); } finally { setLoading(false); }
  };

  return (
    <div className="app-shell">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">💰 Budget Bot</div>
          <p className="auth-sub">Sign in with your Telegram OTP to view your dashboard.</p>

          {!challengeToken ? (
            <form onSubmit={requestOtp}>
              <div className="field">
                <label>Telegram Username or Chat ID</label>
                <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g. @username or 123456789" autoFocus />
              </div>
              <button className="btn-primary" disabled={!identifier.trim() || loading}>
                {loading ? 'Sending…' : 'Send OTP →'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              <div className="field">
                <label>One-Time Password</label>
                <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6} autoFocus />
              </div>
              <button className="btn-primary" disabled={otp.trim().length < 6 || loading}>
                {loading ? 'Verifying…' : 'Verify & Sign In →'}
              </button>
              <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setChallengeToken(null); setStatus(''); }}>
                ← Back
              </button>
            </form>
          )}

          {status && <p className={`status-msg${isError ? ' error' : ''}`}>{status}</p>}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen