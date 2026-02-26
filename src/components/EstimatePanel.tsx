import { useState } from 'react';
import { money } from '@/lib/utils/format';

export default function EstimatePanel({ projectId, estimate }: { projectId: string; estimate: any | null }) {
  const [form, setForm] = useState({
    overhead_pct: estimate?.overhead_pct ?? 0.12,
    profit_pct: estimate?.profit_pct ?? 0.15,
    tax_pct: estimate?.tax_pct ?? 0.0825,
    tax_mode: 'materials_only'
  });
  const [totals, setTotals] = useState(estimate);

  async function calculate() {
    const res = await fetch(`/api/estimate/${projectId}/calculate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    setTotals(data);
    window.location.assign(`/projects/${projectId}/estimate?updated=1`);
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-4 sm:grid-cols-4">
        <label>
          <p className="label">Overhead %</p>
          <input className="input" type="number" step="0.01" value={form.overhead_pct} onChange={(e) => setForm({ ...form, overhead_pct: Number(e.target.value) })} />
        </label>
        <label>
          <p className="label">Profit %</p>
          <input className="input" type="number" step="0.01" value={form.profit_pct} onChange={(e) => setForm({ ...form, profit_pct: Number(e.target.value) })} />
        </label>
        <label>
          <p className="label">Tax %</p>
          <input className="input" type="number" step="0.0001" value={form.tax_pct} onChange={(e) => setForm({ ...form, tax_pct: Number(e.target.value) })} />
        </label>
        <label>
          <p className="label">Tax Mode</p>
          <select className="input" value={form.tax_mode} onChange={(e) => setForm({ ...form, tax_mode: e.target.value })}>
            <option value="materials_only">Materials Only</option>
            <option value="grand_total">Grand Total</option>
          </select>
        </label>
      </div>

      <button onClick={calculate} className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Calculate Estimate</button>

      {totals && (
        <div className="card p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>Materials: {money(totals.subtotal_materials)}</p>
            <p>Labor: {money(totals.subtotal_labor)}</p>
            <p>Overhead: {money(totals.overhead_amount)}</p>
            <p>Profit: {money(totals.profit_amount)}</p>
            <p>Tax: {money(totals.tax_amount)}</p>
            <p className="font-semibold">Grand Total: {money(totals.grand_total)}</p>
          </div>
        </div>
      )}

      {totals ? (
        <a href={`/projects/${projectId}/export`} className="inline-block rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Continue to Export</a>
      ) : (
        <p className="text-sm text-slate-500">Calculate estimate to continue.</p>
      )}
    </div>
  );
}
