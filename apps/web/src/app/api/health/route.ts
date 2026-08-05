import { NextResponse } from 'next/server';
import { logger } from '@spain/observability';

export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const body = {
    status: 'ok',
    phase: 1,
    checks: {
      app: true,
      databaseUrlConfigured: databaseConfigured,
      otpProvider: process.env.OTP_PROVIDER ?? 'fake',
      jobsProvider: process.env.JOBS_PROVIDER ?? 'inline',
      featureWhatsapp: process.env.FEATURE_WHATSAPP === 'true',
      featurePhoneVoice: process.env.FEATURE_PHONE_VOICE === 'true',
    },
    timestamp: new Date().toISOString(),
  };
  logger.info('health_check', body.checks);
  return NextResponse.json(body);
}
