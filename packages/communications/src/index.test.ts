import { describe, expect, it, beforeEach } from 'vitest';
import {
  InMemoryOtpStore,
  OtpAbuseError,
  clearFakeEmailOutbox,
  clearFakeSmsOutbox,
  createFakeEmailAdapter,
  createFakeSmsAdapter,
  getFakeEmailOutbox,
  getFakeSmsOutbox,
  whatsAppStubAdapter,
} from './index';

describe('fake adapters', () => {
  beforeEach(() => {
    clearFakeEmailOutbox();
    clearFakeSmsOutbox();
  });

  it('records fake email and sms deliveries', async () => {
    const email = createFakeEmailAdapter();
    const sms = createFakeSmsAdapter();
    await email.sendTransactional({ to: 'a@example.com', subject: 'OTP', text: '123456' });
    await sms.sendOtp({ to: '+34123456789', body: '123456' });
    expect(getFakeEmailOutbox()).toHaveLength(1);
    expect(getFakeSmsOutbox()).toHaveLength(1);
  });

  it('keeps WhatsApp non-operational in Phase 1', () => {
    expect(whatsAppStubAdapter.operational).toBe(false);
  });
});

describe('OTP store', () => {
  it('issues and verifies codes with cooldown', async () => {
    const store = new InMemoryOtpStore({
      resendCooldownSeconds: 60,
      maxPerIdentityPerHour: 5,
      maxPerIpPerHour: 20,
    });
    const first = await store.requestCode({
      channel: 'email',
      destination: 'buyer@example.com',
      ip: '127.0.0.1',
    });
    await expect(
      store.requestCode({
        channel: 'email',
        destination: 'buyer@example.com',
        ip: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(OtpAbuseError);

    const verified = await store.verifyCode({
      challengeId: first.challengeId,
      code: first.code,
    });
    expect(verified.destination).toBe('buyer@example.com');
  });

  it('rejects wrong codes', async () => {
    const store = new InMemoryOtpStore();
    const first = await store.requestCode({
      channel: 'sms',
      destination: '+34600000000',
      ip: '10.0.0.1',
    });
    await expect(
      store.verifyCode({ challengeId: first.challengeId, code: '000000' }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});
