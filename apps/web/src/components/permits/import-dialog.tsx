'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { ImportResultDTO } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { apiFetch, downloadFromApi } from '@/lib/api-client';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({ open, onClose, onImported }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResultDTO | null>(null);

  function close() {
    setFile(null);
    setResult(null);
    onClose();
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await apiFetch<ImportResultDTO>('/api/permits/import', { method: 'POST', body });
      setResult(data);
      onImported();
      toast.success(`Imported ${data.stats.inserted + data.stats.updated} row(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Import from Excel"
      description="Upload the PTW register (.xlsx). Each upload is saved as its own dated snapshot; multiple certificates in Excel should be separated by semicolons."
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!file} loading={busy}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-sm text-slate-500 hover:border-brand-500 hover:bg-brand-50/40"
          >
            <Upload className="h-6 w-6" />
            {file ? (
              <span className="font-medium text-slate-800">{file.name}</span>
            ) : (
              <span>Click to choose an .xlsx file</span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Rows with an existing <b>New PTW Number</b> update that permit; all other rows are
              added to the current register. A separate read-only copy is saved under this import
              date. Sr No is assigned automatically. Expired plans are highlighted; Status is not
              changed automatically.
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadFromApi('/api/permits/template', 'PTW-Register-Template.xlsx')}
            >
              <Download className="h-4 w-4" /> Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="blue">{result.stats.total} rows read</Badge>
            <Badge tone="green">{result.stats.inserted} added</Badge>
            <Badge tone="purple">{result.stats.updated} updated</Badge>
            <Badge tone={result.stats.failed ? 'red' : 'slate'}>
              {result.stats.failed} skipped
            </Badge>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-red-200">
              <table className="min-w-full text-xs">
                <thead className="bg-red-50 text-left text-red-700">
                  <tr>
                    <th className="px-3 py-2">Excel row</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {result.errors.map((error) => (
                    <tr key={error.row}>
                      <td className="px-3 py-2 font-medium">{error.row}</td>
                      <td className="px-3 py-2 text-slate-700">{error.messages.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
