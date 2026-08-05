import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authProvider, mapOtpError } from '@/lib/auth-runtime';

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
    const issued = await authProvider.requestOtp({
      channel: body.channel,
      destination: body.destination,
      ip,
    });

    return NextResponse.json({
      challengeId: issued.challengeId,
      cooldownSeconds: issued.cooldownSeconds,
      devCode: issued.devCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const mapped = mapOtpError(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
