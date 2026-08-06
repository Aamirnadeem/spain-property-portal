import { NextResponse } from 'next/server';
import { BuyerWorkspaceError } from '@spain/database';

export function workspaceErrorResponse(err: unknown) {
  if (err instanceof BuyerWorkspaceError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  throw err;
}
