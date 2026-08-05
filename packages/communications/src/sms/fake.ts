import { logger } from '@spain/observability';
import type { SmsAdapter } from '../types';

const outbox: Array<{ to: string; body: string; at: string }> = [];

export function getFakeSmsOutbox() {
  return [...outbox];
}

export function clearFakeSmsOutbox() {
  outbox.length = 0;
}

export function createFakeSmsAdapter(): SmsAdapter {
  return {
    name: 'fake-sms',
    async sendOtp({ to, body, correlationId }) {
      const providerMessageId = `fake-sms-${Date.now()}`;
      outbox.push({ to, body, at: new Date().toISOString() });
      logger.info('fake_sms_sent', { correlationId, to, providerMessageId });
      return { providerMessageId };
    },
  };
}
