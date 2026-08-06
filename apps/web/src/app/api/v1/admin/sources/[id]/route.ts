import { NextResponse } from 'next/server';
import { z } from 'zod';
import { imageRightsEnum, sourcePermissionStatusEnum } from '@spain/database/schema';
import { NotFoundError, updateSourcePermission } from '@spain/database';
import { withAppAuthenticatedDb } from '@/lib/authenticated-db';
import { getSession } from '@/lib/session';
import { isErrorResponse, resolveAdminContext } from '@/lib/partner-auth';

const patchSchema = z.object({
  toStatus: z.enum(sourcePermissionStatusEnum.enumValues),
  toImageRights: z.enum(imageRightsEnum.enumValues).optional(),
  note: z.string().max(2000).optional(),
  actorUserId: z.string().uuid().optional(), // ignored — session actor only
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withAppAuthenticatedDb(session.userId, async (db) => {
    const ctx = await resolveAdminContext(request, db, { platformAdminOnly: true });
    if (isErrorResponse(ctx)) return ctx;
    const { id } = await context.params;
    const body = patchSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: body.error.issues },
        { status: 400 },
      );
    }
    try {
      const source = await updateSourcePermission(db, {
        dataSourceId: id,
        actorUserId: ctx.userId,
        toStatus: body.data.toStatus,
        toImageRights: body.data.toImageRights,
        note: body.data.note,
      });
      return NextResponse.json({ source });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw error;
    }
  });
}
