import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const tone = status === 'Closed' ? 'green' : status === 'Overdue' ? 'red' : 'amber';
  return <Badge tone={tone}>{status}</Badge>;
}
