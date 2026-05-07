import { ChangeEvent, useState } from "react"
import { trpc } from "@web/trpc"

export const useOtpChallenge = (onLogin: () => void) => {
  const [identifier, setIdentifier] = useState("")
  const [otp, setOtp] = useState("")
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  const requestOtpMutation = trpc.auth.requestOtp.useMutation()
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation()

  const loading = requestOtpMutation.isPending || verifyOtpMutation.isPending

  const errorMessage = requestOtpMutation.error?.message || verifyOtpMutation.error?.message

  const buildPayload = () => {
    if (/^\d+$/.test(identifier)) {
      return {
        chatId: Number(identifier)
      }
    }

    return {
      username: identifier.replace(/^@/, "")
    }
  }

  const requestOtp = async () => {
    setStatus("")

    const data = await requestOtpMutation.mutateAsync(buildPayload())

    setChallengeToken(data.challengeToken)

    setStatus("OTP sent to your Telegram. Enter it below.")
  }

  const verifyOtp = async () => {
    if (!challengeToken) return

    setStatus("")

    const data = await verifyOtpMutation.mutateAsync({
      ...buildPayload(),
      otp: otp.trim(),
      challengeToken
    })

    if (data.sessionToken) {
      const isLocalhost =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"

      const secure = isLocalhost ? "" : " Secure;"

      document.cookie = `budget_session=${data.sessionToken}; path=/; max-age=${
        7 * 24 * 60 * 60
      }; SameSite=Lax;${secure}`
    }

    onLogin()
  }

  const reset = () => {
    setChallengeToken(null)
    setOtp("")
    setStatus("")

    requestOtpMutation.reset()
    verifyOtpMutation.reset()
  }

  return {
    identifier,
    otp,

    challengeStarted: Boolean(challengeToken),

    loading,

    message: errorMessage || status,
    isError: Boolean(errorMessage),

    canRequestOtp: Boolean(identifier.trim()),
    canVerifyOtp: otp.trim().length >= 6,

    onIdentifierChange: (e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value),

    onOtpChange: (e: ChangeEvent<HTMLInputElement>) => setOtp(e.target.value),

    requestOtp,
    verifyOtp,
    reset
  }
}
