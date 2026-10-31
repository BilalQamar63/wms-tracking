'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { formatDisplayDate, type ImportPreviewDTO, type ImportResultDTO } from '@wms/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { apiFetch, downloadFromApi } from '@/lib/api-client';

interface Props {
  open: boolean;
  canUpdate: boolean;
  assignedSubContractor?: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({
  open,
  canUpdate,
  assignedSubContractor,
  onClose,
  onImported,
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewDTO | null>(null);
  const [approvedFields, setApprovedFields] = useState<Record<number, string[]>>({});
  const [addRows, setAddRows] = useState<number[]>([]);
  const [result, setResult] = useState<ImportResultDTO | null>(null);

  function close() {
    setFile(null);
    setPreview(null);
    setApprovedFields({});
    setAddRows([]);
    setResult(null);
    onClose();
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      if (!preview) {
        const data = await apiFetch<ImportPreviewDTO>('/api/permits/import', {
          method: 'POST',
          body,
        });
        setPreview(data);
        setApprovedFields(
          Object.fromEntries(
            data.rows
              .filter((row) => row.action === 'update')
              .map((row) => [row.rowNumber, row.fields.map((field) => field.key)]),
          ),
        );
        setAddRows(data.rows.filter((row) => row.action === 'add').map((row) => row.rowNumber));
        toast.success('Review the imported values and choose what to apply');
        return;
      }

      body.append(
        'approvals',
        JSON.stringify(
          preview.rows
            .filter((row) => row.action === 'update')
            .map((row) => ({
              rowNumber: row.rowNumber,
              fields: row.fields
                .filter((field) => approvedFields[row.rowNumber]?.includes(field.key))
                .map((field) => ({ key: field.key, expectedOldValue: field.oldValue })),
            })),
        ),
      );
      body.append('addRows', JSON.stringify(addRows));
      const data = await apiFetch<ImportResultDTO>('/api/permits/import/commit', {
        method: 'POST',
        body,
      });
      setResult(data);
      onImported();
      toast.success(`Import complete: ${data.stats.inserted} added, ${data.stats.updated} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  function toggleField(rowNumber: number, fieldKey: string) {
    setApprovedFields((current) => {
      const selected = new Set(current[rowNumber] ?? []);
      if (selected.has(fieldKey)) selected.delete(fieldKey);
      else selected.add(fieldKey);
      return { ...current, [rowNumber]: [...selected] };
    });
  }

  function toggleAddRow(rowNumber: number) {
    setAddRows((current) =>
      current.includes(rowNumber)
        ? current.filter((value) => value !== rowNumber)
        : [...current, rowNumber],
    );
  }

  function formatValue(value: string | string[] | null, type: string): string {
    if (value === null) return '—';
    if (Array.isArray(value)) return value.join('; ');
    if (type === 'date') return formatDisplayDate(value);
    return value;
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Import from Excel"
      description={
        canUpdate
          ? 'Upload an Excel register to compare it with the current register. Review each changed field before applying it; uploads are recorded in history.'
          : `Upload an Excel register to add new permits for ${assignedSubContractor}. Existing permits cannot be changed; uploads are recorded in admin history.`
      }
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              {preview ? 'Cancel' : 'Close'}
            </Button>
            <Button onClick={submit} disabled={!file} loading={busy}>
              <Upload className="h-4 w-4" />{' '}
              {preview
                ? canUpdate
                  ? 'Apply selected changes'
                  : 'Add selected permits'
                : 'Review import'}
            </Button>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          {!preview ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-sm text-slate-500 hover:border-brand-500 hover:bg-brand-50/40"
              >
                <Upload className="h-6 w-6" />
                {file ? (
                  <span className="font-medium text-slate-800">{file.name}</span>
                ) : (
                  <span>Click to choose an .xlsx or .xlsm file</span>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xlsm"
                hidden
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span>
                  {canUpdate ? (
                    <>
                      Rows with a matching <b>New PTW Number</b> are compared with the current
                      register. New permits can be selected for addition. Missing or unrecognized
                      Main Contractor values default to JV-TR/NMDC.
                    </>
                  ) : (
                    <>
                      Only rows with sub contractor <b>{assignedSubContractor}</b> can be added.
                      Existing permits and other sub contractors are skipped.
                    </>
                  )}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadFromApi('/api/permits/template', 'PTW-Register-Template.xlsx')
                  }
                >
                  <Download className="h-4 w-4" /> Template
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="blue">{preview.totalRows} rows read</Badge>
                <Badge tone="purple">
                  {preview.rows.filter((row) => row.action === 'update').length} matched
                </Badge>
                <Badge tone="green">
                  {preview.rows.filter((row) => row.action === 'add').length} new permits
                </Badge>
                <Badge tone={preview.errors.length ? 'red' : 'slate'}>
                  {preview.errors.length} skipped
                </Badge>
              </div>

              <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Excel row</th>
                      <th className="px-3 py-2">Permit / field</th>
                      <th className="px-3 py-2">Current value</th>
                      <th className="px-3 py-2">Excel value</th>
                      <th className="px-3 py-2">Apply</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.flatMap((row) => {
                      if (row.action === 'add') {
                        const previous = row.fields.find(
                          (field) => field.key === 'previousPtwNumber',
                        );
                        const current = row.fields.find((field) => field.key === 'newPtwNumber');
                        return [
                          <tr key={`${row.rowNumber}-new`} className="bg-emerald-50/40">
                            <td className="px-3 py-2 font-medium">{row.rowNumber}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">New permit</div>
                              <div className="text-slate-500">
                                Previous: {formatValue(previous?.newValue ?? null, 'text')}
                              </div>
                              <div className="text-slate-500">
                                New PTW: {formatValue(current?.newValue ?? null, 'text')}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-slate-500">Not in current register</td>
                            <td className="px-3 py-2">{row.newPtwNumber || 'No New PTW Number'}</td>
                            <td className="px-3 py-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={addRows.includes(row.rowNumber)}
                                  onChange={() => toggleAddRow(row.rowNumber)}
                                />
                                Add
                              </label>
                            </td>
                          </tr>,
                        ];
                      }

                      if (row.fields.length === 0) {
                        return [
                          <tr key={`${row.rowNumber}-same`}>
                            <td className="px-3 py-2">{row.rowNumber}</td>
                            <td className="px-3 py-2" colSpan={4}>
                              PTW {row.newPtwNumber} (Sr No {row.existingSrNo}) — no field changes
                            </td>
                          </tr>,
                        ];
                      }

                      return row.fields.map((field) => (
                        <tr key={`${row.rowNumber}-${field.key}`}>
                          <td className="px-3 py-2 font-medium">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            <div>{field.header}</div>
                            <div className="text-slate-500">
                              PTW {row.newPtwNumber} · Sr No {row.existingSrNo}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {formatValue(field.oldValue, field.type)}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {formatValue(field.newValue, field.type)}
                          </td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={
                                  approvedFields[row.rowNumber]?.includes(field.key) ?? false
                                }
                                onChange={() => toggleField(row.rowNumber, field.key)}
                              />
                              Update
                            </label>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-lg border border-red-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-red-50 text-left text-red-700">
                      <tr>
                        <th className="px-3 py-2">Excel row</th>
                        <th className="px-3 py-2">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {preview.errors.map((error) => (
                        <tr key={error.row}>
                          <td className="px-3 py-2 font-medium">{error.row}</td>
                          <td className="px-3 py-2 text-slate-700">{error.messages.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-slate-500">
                {canUpdate
                  ? 'Select the fields to update. New PTW Number is the match key; upload changes go to the current register only.'
                  : `Only new permits for ${assignedSubContractor} can be added. Existing permits are skipped.`}
              </p>
            </>
          )}
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
