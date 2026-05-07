import react from "react"
import { useOtpChallenge } from "@web/hooks/useOtpChallenge"

const AuthScreen = ({ onLogin }: { onLogin: () => void }) => {
  const {
    identifier,
    otp,

    challengeStarted,

    loading,

    message,
    isError,

    canRequestOtp,
    canVerifyOtp,

    onIdentifierChange,
    onOtpChange,

    requestOtp,
    verifyOtp,
    reset
  } = useOtpChallenge(onLogin)

  const handleRequestOtp = async (e: react.FormEvent) => {
    e.preventDefault()
    await requestOtp()
  }

  const handleVerifyOtp = async (e: react.FormEvent) => {
    e.preventDefault()
    await verifyOtp()
  }

  return (
    <div className="app-shell">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">💰 Budget Bot</div>

          <p className="auth-sub">Sign in with your Telegram OTP to view your dashboard.</p>

          {!challengeStarted ? (
            <form onSubmit={handleRequestOtp}>
              <div className="field">
                <label>Telegram Username or Chat ID</label>

                <input
                  value={identifier}
                  onChange={onIdentifierChange}
                  placeholder="e.g. @username or 123456789"
                  autoFocus
                />
              </div>

              <button className="btn-primary" disabled={!canRequestOtp || loading}>
                {loading ? "Sending…" : "Send OTP →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="field">
                <label>One-Time Password</label>

                <input
                  value={otp}
                  onChange={onOtpChange}
                  placeholder="6-digit code"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button className="btn-primary" disabled={!canVerifyOtp || loading}>
                {loading ? "Verifying…" : "Verify & Sign In →"}
              </button>

              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 8 }}
                onClick={reset}
              >
                ← Back
              </button>
            </form>
          )}

          {message && <p className={`status-msg${isError ? " error" : ""}`}>{message}</p>}
        </div>
      </div>
    </div>
  )
}

export default AuthScreen
