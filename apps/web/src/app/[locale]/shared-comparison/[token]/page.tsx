import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolvePublicComparisonShare } from '@spain/database';
import type { PublicComparisonDto } from '@spain/domain';
import { getMessages, isLocale, type Locale } from '@spain/i18n';
import { getAppDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function SharedComparisonPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: raw, token } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const messages = getMessages(locale);
  const w = messages.workspace;

  if (!token || token.length < 16 || token.length > 128) {
    return (
      <main data-testid="shared-comparison-unavailable">
        <h1>{w.sharedComparisonTitle}</h1>
        <p>{w.sharedComparisonUnavailable}</p>
      </main>
    );
  }

  const { db, client } = getAppDb();
  let dto: PublicComparisonDto | null = null;
  try {
    const result = await resolvePublicComparisonShare(db, token, { uaCategory: 'browser' });
    if (result.status === 'ok') dto = result.dto;
  } finally {
    await client.end({ timeout: 5 });
  }

  if (!dto) {
    return (
      <main data-testid="shared-comparison-unavailable">
        <h1>{w.sharedComparisonTitle}</h1>
        <p>{w.sharedComparisonUnavailable}</p>
      </main>
    );
  }

  const fieldKeys = dto.fields.filter(
    (f) => f !== 'frozen_score' && f !== 'frozen_score_explanation',
  );

  return (
    <main data-testid="shared-comparison-page">
      <h1>{dto.publicTitle ?? w.sharedComparisonTitle}</h1>
      {dto.publicDescription && <p>{dto.publicDescription}</p>}
      {dto.includeScores && dto.disclaimerKey && (
        <p role="note" data-testid="share-score-disclaimer">
          {w.disclaimer}
        </p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table data-testid="shared-comparison-table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              {dto.listings.map((row) => (
                <th key={row.listingId} scope="col">
                  {String(
                    row.cells.title?.status === 'available' ? row.cells.title.value : row.listingId,
                  )}
                  {row.warnings.length > 0 && (
                    <div data-testid={`share-warning-${row.listingId}`}>
                      {w.sharedComparisonWarning}: {row.warnings.join(', ')}
                    </div>
                  )}
                  {dto.includeScores && row.frozenScore?.score != null && (
                    <div>
                      {w.score}: {row.frozenScore.score}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldKeys.map((field) => (
              <tr key={field}>
                <th scope="row">{field}</th>
                {dto.listings.map((row) => {
                  const cell = row.cells[field];
                  return (
                    <td key={row.listingId}>
                      {cell?.status === 'available' ? String(cell.value) : w.unavailable}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
