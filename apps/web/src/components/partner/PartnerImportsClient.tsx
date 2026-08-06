'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ImportRunRow {
  id: string;
  mode: string;
  status: string;
  totalRecords: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  skippedCount: number;
  startedAt: string;
  finishedAt: string | null;
}

interface PartnerImportReport {
  runId: string;
  mode: string;
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  skipped: number;
  errors: Array<{
    recordIndex: number;
    code: string;
    message: string;
    externalListingId: string | null;
  }>;
  warnings: Array<{
    recordIndex: number;
    code: string;
    message: string;
    externalListingId: string | null;
  }>;
}

type Labels = {
  uploadTitle: string;
  uploadHint: string;
  chooseFile: string;
  runDryRun: string;
  runImport: string;
  importHistory: string;
  viewDetail: string;
  rowsTotal: string;
  rowsInserted: string;
  rowsUpdated: string;
  rowsRejected: string;
  rowsSkipped: string;
  previewTitle: string;
  errorsTitle: string;
  noErrors: string;
};

export function PartnerImportsClient({ locale, labels }: { locale: string; labels: Labels }) {
  const [runs, setRuns] = useState<ImportRunRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<PartnerImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadHistory() {
    const res = await fetch('/api/v1/partner/imports', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      setRuns(data.items ?? []);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function submit(mode: 'dry_run' | 'confirm') {
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    const res = await fetch('/api/v1/partner/imports', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'import_failed');
      return;
    }
    setReport(data);
    await loadHistory();
  }

  return (
    <section data-testid="partner-imports">
      <div
        style={{
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          display: 'grid',
          gap: '0.6rem',
          maxWidth: 480,
        }}
      >
        <h2 style={{ margin: 0 }}>{labels.uploadTitle}</h2>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
          {labels.uploadHint}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          data-testid="partner-csv-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => submit('dry_run')}
            data-testid="partner-dry-run"
          >
            {labels.runDryRun}
          </button>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => submit('confirm')}
            data-testid="partner-run-import"
          >
            {labels.runImport}
          </button>
        </div>
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      </div>

      {report ? (
        <div data-testid="partner-import-report" style={{ marginTop: '1rem' }}>
          <h3>
            {report.mode === 'dry_run'
              ? labels.previewTitle
              : `${labels.runImport} #${report.runId}`}
          </h3>
          <dl className="detail-grid">
            <div>
              <dt>{labels.rowsTotal}</dt>
              <dd>{report.total}</dd>
            </div>
            <div>
              <dt>{labels.rowsInserted}</dt>
              <dd data-testid="partner-report-inserted">{report.inserted}</dd>
            </div>
            <div>
              <dt>{labels.rowsUpdated}</dt>
              <dd>{report.updated}</dd>
            </div>
            <div>
              <dt>{labels.rowsRejected}</dt>
              <dd>{report.rejected}</dd>
            </div>
            <div>
              <dt>{labels.rowsSkipped}</dt>
              <dd>{report.skipped}</dd>
            </div>
          </dl>
          <h4>{labels.errorsTitle}</h4>
          {report.errors.length === 0 && report.warnings.length === 0 ? (
            <p>{labels.noErrors}</p>
          ) : (
            <ul>
              {[...report.errors, ...report.warnings].map((e, idx) => (
                <li key={idx}>
                  Row {e.recordIndex} ({e.externalListingId ?? '—'}): [{e.code}] {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <h2 style={{ marginTop: '2rem' }}>{labels.importHistory}</h2>
      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Status</th>
              <th>Inserted</th>
              <th>Updated</th>
              <th>Rejected</th>
              <th>Started</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} data-testid={`partner-run-row-${run.id}`}>
                <td>{run.mode}</td>
                <td>
                  <span className="badge">{run.status}</span>
                </td>
                <td>{run.insertedCount}</td>
                <td>{run.updatedCount}</td>
                <td>{run.rejectedCount}</td>
                <td>{new Date(run.startedAt).toLocaleString()}</td>
                <td>
                  <Link href={`/${locale}/partner/imports/${run.id}`}>{labels.viewDetail}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
