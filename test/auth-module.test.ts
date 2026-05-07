import { describe, expect, it, vi } from "vitest";
import { createAuthModule } from "../src/domain/auth";

describe("AuthModule", () => {
  it("issues OTP challenge and sends OTP", async () => {
    const auth = createAuthModule({
      identityRepo: {
        findChatIdByUsername: vi.fn().mockResolvedValue(123),
      },
      otpMessenger: {
        sendOtp: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        issueSession: vi.fn(),
        verifySession: vi.fn(),
        issueOtpChallenge: vi
          .fn()
          .mockResolvedValue({ challengeToken: "challenge", otp: "123456" }),
        verifyOtpChallenge: vi.fn(),
      },
    });

    const result = await auth.requestOtp({ username: "@alice" });
    expect(result.challengeToken).toBe("challenge");
    expect(result.expiresInSeconds).toBe(300);
  });

  it("verifies OTP and issues session", async () => {
    const auth = createAuthModule({
      identityRepo: {
        findChatIdByUsername: vi.fn().mockResolvedValue(123),
      },
      otpMessenger: {
        sendOtp: vi.fn(),
      },
      session: {
        issueSession: vi.fn().mockResolvedValue("session-token"),
        verifySession: vi.fn(),
        issueOtpChallenge: vi.fn(),
        verifyOtpChallenge: vi.fn().mockResolvedValue(true),
      },
    });

    const result = await auth.verifyOtp({
      username: "alice",
      otp: "123456",
      challengeToken: "challenge",
    });
    expect(result.sessionToken).toBe("session-token");
  });

  it("returns session chat id from session token", async () => {
    const auth = createAuthModule({
      session: {
        issueSession: vi.fn(),
        verifySession: vi.fn().mockResolvedValue({ chatId: 999, exp: Date.now() + 1000 }),
        issueOtpChallenge: vi.fn(),
        verifyOtpChallenge: vi.fn(),
      },
    });

    const chatId = await auth.getSessionChatId("token");
    expect(chatId).toBe(999);
  });
});
