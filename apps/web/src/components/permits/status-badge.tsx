import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge tone={status === 'Closed' ? 'green' : 'amber'}>{status}</Badge>;
}
