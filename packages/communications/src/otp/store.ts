import { z } from 'zod';

export const otpChallengeSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['email', 'sms']),
  destination: z.string().min(3),
  codeHash: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  attemptCount: z.number().int().nonnegative(),
  consumedAt: z.string().datetime().nullable(),
});

export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

export interface OtpRateLimitConfig {
  resendCooldownSeconds: number;
  maxPerIdentityPerHour: number;
  maxPerIpPerHour: number;
}

export const defaultOtpRateLimitConfig = (): OtpRateLimitConfig => ({
  resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),
  maxPerIdentityPerHour: Number(process.env.OTP_MAX_ATTEMPTS_PER_IDENTITY_PER_HOUR ?? 5),
  maxPerIpPerHour: Number(process.env.OTP_MAX_ATTEMPTS_PER_IP_PER_HOUR ?? 20),
});

export class OtpAbuseError extends Error {
  constructor(
    message: string,
    readonly code: 'cooldown' | 'identity_limit' | 'ip_limit' | 'invalid' | 'expired' | 'consumed',
  ) {
    super(message);
    this.name = 'OtpAbuseError';
  }
}

/** Simple SHA-256 style hash for Node/browser-free environments via Web Crypto when available. */
export async function hashOtpCode(code: string, pepper = 'spain-otp-dev-pepper'): Promise<string> {
  const data = new TextEncoder().encode(`${pepper}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateNumericOtp(length = 6): string {
  const max = 10 ** length;
  const n = Math.floor(Math.random() * max);
  return n.toString().padStart(length, '0');
}

export class InMemoryOtpStore {
  private challenges = new Map<string, OtpChallenge>();
  private sendEvents: Array<{ destination: string; ip: string; at: number }> = [];

  constructor(private readonly config: OtpRateLimitConfig = defaultOtpRateLimitConfig()) {}

  async requestCode(input: {
    channel: 'email' | 'sms';
    destination: string;
    ip: string;
    now?: Date;
  }): Promise<{ challengeId: string; code: string; cooldownSeconds: number }> {
    const now = input.now ?? new Date();
    const nowMs = now.getTime();
    const hourAgo = nowMs - 60 * 60 * 1000;

    const recent = this.sendEvents.filter((e) => e.at >= hourAgo);
    this.sendEvents = recent;

    if (recent.filter((e) => e.ip === input.ip).length >= this.config.maxPerIpPerHour) {
      throw new OtpAbuseError('Too many OTP requests from this IP', 'ip_limit');
    }
    if (
      recent.filter((e) => e.destination === input.destination).length >=
      this.config.maxPerIdentityPerHour
    ) {
      throw new OtpAbuseError('Too many OTP requests for this identity', 'identity_limit');
    }

    const lastForDest = [...this.challenges.values()]
      .filter((c) => c.destination === input.destination)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (lastForDest) {
      const elapsed = nowMs - new Date(lastForDest.createdAt).getTime();
      const cooldownMs = this.config.resendCooldownSeconds * 1000;
      if (elapsed < cooldownMs) {
        throw new OtpAbuseError('OTP resend cooldown active', 'cooldown');
      }
    }

    const code = generateNumericOtp(6);
    const id = crypto.randomUUID();
    const challenge: OtpChallenge = {
      id,
      channel: input.channel,
      destination: input.destination,
      codeHash: await hashOtpCode(code),
      createdAt: now.toISOString(),
      expiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
      attemptCount: 0,
      consumedAt: null,
    };
    this.challenges.set(id, challenge);
    this.sendEvents.push({ destination: input.destination, ip: input.ip, at: nowMs });
    return {
      challengeId: id,
      code,
      cooldownSeconds: this.config.resendCooldownSeconds,
    };
  }

  async verifyCode(input: {
    challengeId: string;
    code: string;
    now?: Date;
  }): Promise<{ destination: string; channel: 'email' | 'sms' }> {
    const now = input.now ?? new Date();
    const challenge = this.challenges.get(input.challengeId);
    if (!challenge) throw new OtpAbuseError('Unknown challenge', 'invalid');
    if (challenge.consumedAt) throw new OtpAbuseError('Code already used', 'consumed');
    if (new Date(challenge.expiresAt).getTime() < now.getTime()) {
      throw new OtpAbuseError('Code expired', 'expired');
    }
    challenge.attemptCount += 1;
    const hash = await hashOtpCode(input.code);
    if (hash !== challenge.codeHash) {
      throw new OtpAbuseError('Invalid code', 'invalid');
    }
    challenge.consumedAt = now.toISOString();
    return { destination: challenge.destination, channel: challenge.channel };
  }
}
