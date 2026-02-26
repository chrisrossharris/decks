import { useMemo, useState } from 'react';
import type { TakeoffItem } from '@/lib/types/domain';

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export default function TakeoffTable({ projectId, items, diff }: { projectId: string; items: any[]; diff: any }) {
  const [rows, setRows] = useState(items as (TakeoffItem & { id: string })[]);

  const patch = useMemo(
    () =>
      debounce(async (id: string, payload: Partial<TakeoffItem>) => {
        await fetch(`/api/takeoffs/item/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }, 350),
    []
  );

  function edit(id: string, field: keyof TakeoffItem, value: string) {
    const parsed = ['qty', 'waste_factor', 'unit_cost', 'lead_time_days'].includes(field)
      ? Number(value)
      : value;

    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: parsed } : row))
    );

    patch(id, { [field]: parsed } as Partial<TakeoffItem>);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm">
        <p className="font-semibold">Version Diff</p>
        <p>Added: {diff.added.length} | Removed: {diff.removed.length} | Qty Changed: {diff.changed.length}</p>
      </div>
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm leading-tight">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {['Category', 'Name', 'Qty', 'Waste', 'Unit Cost', 'Lead Days', 'Vendor', 'Notes'].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-2 py-1.5 align-top whitespace-nowrap">{row.category}</td>
                <td className="px-2 py-1.5 align-top min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span>{row.name}</span>
                    {row.is_allowance && <span className="badge-allowance">Allowance</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[92px] py-1" value={row.qty} onChange={(e) => edit(row.id, 'qty', e.target.value)} /></td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[92px] py-1" value={row.waste_factor} onChange={(e) => edit(row.id, 'waste_factor', e.target.value)} /></td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[110px] py-1" value={row.unit_cost} onChange={(e) => edit(row.id, 'unit_cost', e.target.value)} /></td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[92px] py-1" value={row.lead_time_days} onChange={(e) => edit(row.id, 'lead_time_days', e.target.value)} /></td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[120px] py-1" value={row.vendor ?? ''} onChange={(e) => edit(row.id, 'vendor', e.target.value)} /></td>
                <td className="px-2 py-1.5 align-top"><input className="input mt-0 h-9 min-w-[120px] py-1" value={row.notes ?? ''} onChange={(e) => edit(row.id, 'notes', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href={`/projects/${projectId}/labor`} className="inline-block rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Continue to Labor</a>
    </div>
  );
}
