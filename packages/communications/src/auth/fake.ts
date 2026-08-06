import type { EmailAdapter, SmsAdapter } from '../types';
import { InMemoryOtpStore } from '../otp/store';
import {
  canExposeDevCode,
  type AuthProvider,
  type AuthUser,
  type AuthVerifyResult,
  type RequestOtpInput,
  type RequestOtpResult,
  type VerifyOtpInput,
} from './provider';

export interface FakeAuthProviderOptions {
  emailAdapter: EmailAdapter;
  smsAdapter: SmsAdapter;
  otpStore?: InMemoryOtpStore;
  nodeEnv?: string;
}

/**
 * Non-persistent provider for local development and tests only.
 * User IDs and OTP challenges are lost on process restart.
 */
export class FakeAuthProvider implements AuthProvider {
  readonly name = 'fake' as const;
  readonly persistent = false;

  private readonly otpStore: InMemoryOtpStore;
  private readonly usersByIdentity = new Map<string, AuthUser>();

  constructor(private readonly options: FakeAuthProviderOptions) {
    this.otpStore = options.otpStore ?? new InMemoryOtpStore();
    if (!canExposeDevCode(options.nodeEnv ?? process.env.NODE_ENV)) {
      throw new Error('FakeAuthProvider may only run in development or test environments');
    }
  }

  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    const issued = await this.otpStore.requestCode({
      channel: input.channel,
      destination: input.destination,
      ip: input.ip ?? '127.0.0.1',
    });

    if (input.channel === 'email') {
      await this.options.emailAdapter.sendTransactional({
        to: input.destination,
        subject: 'Your sign-in code',
        text: `Your Spain Property Portal code is ${issued.code}`,
      });
    } else {
      await this.options.smsAdapter.sendOtp({
        to: input.destination,
        body: `Your Spain Property Portal code is ${issued.code}`,
      });
    }

    return {
      challengeId: issued.challengeId,
      cooldownSeconds: issued.cooldownSeconds,
      devCode: issued.code,
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<AuthVerifyResult> {
    const verified = await this.otpStore.verifyCode(input);
    const identityKey = `${verified.channel}:${verified.destination}`;
    const existing = this.usersByIdentity.get(identityKey);
    if (existing) return { user: existing };

    const user: AuthUser = {
      id: crypto.randomUUID(),
      email: verified.channel === 'email' ? verified.destination : undefined,
      mobile: verified.channel === 'sms' ? verified.destination : undefined,
    };
    this.usersByIdentity.set(identityKey, user);
    return { user };
  }
}
