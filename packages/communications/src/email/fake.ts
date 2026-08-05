import { logger } from '@spain/observability';
import type { EmailAdapter } from '../types';

const outbox: Array<{ to: string; subject: string; text: string; at: string }> = [];

export function getFakeEmailOutbox() {
  return [...outbox];
}

export function clearFakeEmailOutbox() {
  outbox.length = 0;
}

export function createFakeEmailAdapter(): EmailAdapter {
  return {
    name: 'fake-email',
    async sendTransactional({ to, subject, text, correlationId }) {
      const providerMessageId = `fake-email-${Date.now()}`;
      outbox.push({ to, subject, text, at: new Date().toISOString() });
      logger.info('fake_email_sent', {
        correlationId,
        to,
        subject,
        providerMessageId,
        // OTP codes may appear in text in fake mode — logged for local/CI only
      });
      return { providerMessageId };
    },
  };
}
