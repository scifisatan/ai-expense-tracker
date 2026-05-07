import { z } from "zod"

export const authIdentifierSchema = z.object({
  username: z.string().optional(),
  chatId: z.number().optional()
})

export const requestOtpInputSchema = authIdentifierSchema

export const verifyOtpInputSchema = authIdentifierSchema.extend({
  otp: z.string(),
  challengeToken: z.string()
})

export type AuthIdentifier = {
  username?: string
  chatId?: number
}

export type VerifyOtpInput = AuthIdentifier & {
  otp: string
  challengeToken: string
}
