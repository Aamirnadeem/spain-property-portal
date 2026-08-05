import type { SpeechAdapter, TelephonyAdapter, WhatsAppAdapter } from './types';

export const whatsAppStubAdapter: WhatsAppAdapter = {
  name: 'whatsapp-stub',
  operational: false,
};

export const speechStubAdapter: SpeechAdapter = {
  name: 'speech-stub',
  operational: false,
};

export const telephonyStubAdapter: TelephonyAdapter = {
  name: 'telephony-stub',
  operational: false,
};
