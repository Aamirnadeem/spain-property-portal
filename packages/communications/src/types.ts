export type OtpChannel = 'email' | 'sms';

export interface SendOtpInput {
  channel: OtpChannel;
  destination: string;
  code: string;
  correlationId?: string;
}

export interface EmailAdapter {
  readonly name: string;
  sendTransactional(input: {
    to: string;
    subject: string;
    text: string;
    correlationId?: string;
  }): Promise<{ providerMessageId: string }>;
}

export interface SmsAdapter {
  readonly name: string;
  sendOtp(input: {
    to: string;
    body: string;
    correlationId?: string;
  }): Promise<{ providerMessageId: string }>;
}

/** Phase 7+ — interface only; not operational in Phase 1. */
export interface WhatsAppAdapter {
  readonly name: string;
  readonly operational: false;
}

/** Phase 8+ — interface only; not operational in Phase 1. */
export interface SpeechAdapter {
  readonly name: string;
  readonly operational: false;
}

export interface TelephonyAdapter {
  readonly name: string;
  readonly operational: false;
}
