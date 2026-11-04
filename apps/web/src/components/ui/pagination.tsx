import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
  showPageInput?: boolean;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
  showPageInput = false,
}: PaginationProps) {
  const [pageInput, setPageInput] = useState(String(page));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const requestedPage = Number(pageInput);
  const canJump =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages;

  useEffect(() => setPageInput(String(page)), [page]);

  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canJump) onChange(requestedPage);
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {showPageInput ? (
          <form onSubmit={jumpToPage} className="flex items-center gap-2">
            <label htmlFor="pagination-page-input" className="sr-only">
              Go to page
            </label>
            <Input
              id="pagination-page-input"
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className="h-9 w-20"
              aria-label="Go to page"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!canJump}>
              Go
            </Button>
          </form>
        ) : null}
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
