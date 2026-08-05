'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readSpainUserId } from '@/lib/demo-identities';

interface ImportRun {
  id: string;
  mode: string;
  status: string;
  parserVersion: string | null;
  totalRecords: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  skippedCount: number;
  startedAt: string;
  finishedAt: string | null;
}

interface ImportError {
  id: string;
  recordIndex: number;
  externalListingId: string | null;
  code: string;
  message: string;
}

type Labels = {
  runDetail: string;
  backToImports: string;
  rowsTotal: string;
  rowsInserted: string;
  rowsUpdated: string;
  rowsRejected: string;
  rowsSkipped: string;
  errorsTitle: string;
  noErrors: string;
  mode: string;
  startedAt: string;
  finishedAt: string;
  runStatus: string;
};

export function PartnerImportDetailClient({
  locale,
  importRunId,
  labels,
}: {
  locale: string;
  importRunId: string;
  labels: Labels;
}) {
  const [run, setRun] = useState<ImportRun | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const userId = readSpainUserId();
      if (!userId) {
        setError('not_signed_in');
        return;
      }
      const res = await fetch(`/api/v1/partner/imports/${importRunId}`, {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? 'load_failed');
        return;
      }
      const data = await res.json();
      setRun(data.run);
      setErrors(data.errors ?? []);
    })();
  }, [importRunId]);

  return (
    <section data-testid="partner-import-detail">
      <Link href={`/${locale}/partner/imports`}>{labels.backToImports}</Link>
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{labels.runDetail}</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {run ? (
        <dl className="detail-grid">
          <div>
            <dt>{labels.mode}</dt>
            <dd>{run.mode}</dd>
          </div>
          <div>
            <dt>{labels.runStatus}</dt>
            <dd>
              <span className="badge">{run.status}</span>
            </dd>
          </div>
          <div>
            <dt>{labels.rowsTotal}</dt>
            <dd>{run.totalRecords}</dd>
          </div>
          <div>
            <dt>{labels.rowsInserted}</dt>
            <dd>{run.insertedCount}</dd>
          </div>
          <div>
            <dt>{labels.rowsUpdated}</dt>
            <dd>{run.updatedCount}</dd>
          </div>
          <div>
            <dt>{labels.rowsRejected}</dt>
            <dd>{run.rejectedCount}</dd>
          </div>
          <div>
            <dt>{labels.rowsSkipped}</dt>
            <dd>{run.skippedCount}</dd>
          </div>
          <div>
            <dt>{labels.startedAt}</dt>
            <dd>{new Date(run.startedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>{labels.finishedAt}</dt>
            <dd>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</dd>
          </div>
        </dl>
      ) : null}

      <h2>{labels.errorsTitle}</h2>
      {errors.length === 0 ? (
        <p>{labels.noErrors}</p>
      ) : (
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>External ID</th>
                <th>Code</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id}>
                  <td>{e.recordIndex}</td>
                  <td>{e.externalListingId ?? '—'}</td>
                  <td>{e.code}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
