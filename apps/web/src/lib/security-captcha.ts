import { api } from "@/lib/api/client";

type Challenge = { id: string; nonce: string; difficulty: number; expiresAt: string };
type CaptchaAction = "otp" | "comment_submit_guest";

/** Solve the configured browser check immediately before a public form submission. */
export async function captchaTokenFor(action: CaptchaAction): Promise<string | undefined> {
  const policies = (await api.get<Array<{ action: string; captchaEnabled: boolean }>>("/auth/security-policy", { params: { t: Date.now() } })).data;
  if (!policies.some((policy) => policy.action === action && policy.captchaEnabled)) return undefined;
  const challenge = (await api.post<Challenge>("/captcha/challenge", { action })).data;
  if (!challenge || !Number.isInteger(challenge.difficulty) || challenge.difficulty < 1 || challenge.difficulty > 24) throw new Error("Invalid browser challenge");
  const encoder = new TextEncoder();
  for (let solution = 0; solution <= 0xffffffff; solution++) {
    if (Date.now() >= Date.parse(challenge.expiresAt)) throw new Error("Browser challenge expired");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${challenge.id}:${challenge.nonce}:${solution}`)));
    const wholeBytes = Math.floor(challenge.difficulty / 8);
    let accepted = true;
    for (let index = 0; index < wholeBytes; index++) if (digest[index] !== 0) { accepted = false; break; }
    const remainingBits = challenge.difficulty % 8;
    if (accepted && (!remainingBits || digest[wholeBytes] >> (8 - remainingBits) === 0)) return `${challenge.id}.${solution}`;
  }
  throw new Error("Browser challenge could not be solved");
}
