import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailAdapter, mapOtpError, otpStore, smsAdapter } from '@/lib/auth-runtime';

const bodySchema = z.object({
  channel: z.enum(['email', 'sms']),
  destination: z.string().min(3),
  guestKey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const issued = await otpStore.requestCode({
      channel: body.channel,
      destination: body.destination,
      ip,
    });

    if (body.channel === 'email') {
      await emailAdapter.sendTransactional({
        to: body.destination,
        subject: 'Your sign-in code',
        text: `Your Spain Property Portal code is ${issued.code}`,
      });
    } else {
      await smsAdapter.sendOtp({
        to: body.destination,
        body: `Your Spain Property Portal code is ${issued.code}`,
      });
    }

    return NextResponse.json({
      challengeId: issued.challengeId,
      cooldownSeconds: issued.cooldownSeconds,
      // Exposed only when OTP_PROVIDER=fake for local/CI e2e
      devCode:
        process.env.OTP_PROVIDER === 'fake' || !process.env.OTP_PROVIDER ? issued.code : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const mapped = mapOtpError(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
