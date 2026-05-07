import type { AuthSession, SessionPayload, OtpChallengePayload } from "../ports/auth-session";

export class TokenSessionManager implements AuthSession {
  constructor(private secret: string) {}

  private base64UrlEncode(value: string) {
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  private base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return atob(normalized + pad);
  }

  private async hmac(value: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
    return this.base64UrlEncode(String.fromCharCode(...new Uint8Array(signed)));
  }

  private async sha256Hex(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private async signToken(payload: any): Promise<string> {
    const body = this.base64UrlEncode(JSON.stringify(payload));
    const sig = await this.hmac(body);
    return `${body}.${sig}`;
  }

  async issueSession(chatId: number): Promise<string> {
    return this.signToken({
      chatId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  }

  async verifySession(token: string): Promise<SessionPayload | null> {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    if (sig !== (await this.hmac(body))) return null;

    try {
      const payload = JSON.parse(this.base64UrlDecode(body)) as SessionPayload;
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async issueOtpChallenge(chatId: number) {
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const nonce = crypto.randomUUID();
    const exp = Date.now() + 5 * 60 * 1000;
    const otpHash = await this.sha256Hex(`${otp}:${chatId}:${nonce}`);

    const challengeToken = await this.signToken({
      chatId,
      nonce,
      otpHash,
      exp,
    } as OtpChallengePayload);

    return { challengeToken, otp };
  }

  async verifyOtpChallenge(challengeToken: string, chatId: number, otp: string): Promise<boolean> {
    const [body, sig] = challengeToken.split(".");
    if (!body || !sig) return false;
    if (sig !== (await this.hmac(body))) return false;

    try {
      const challenge = JSON.parse(this.base64UrlDecode(body)) as OtpChallengePayload;
      if (challenge.exp < Date.now() || challenge.chatId !== chatId) return false;

      const actualHash = await this.sha256Hex(`${otp}:${chatId}:${challenge.nonce}`);
      return actualHash === challenge.otpHash;
    } catch {
      return false;
    }
  }
}
