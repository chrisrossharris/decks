import { useState } from 'react';
import { money } from '@/lib/utils/format';

const DRIVER_LABELS: Record<string, string> = {
  include_demo: 'Include demo toggle',
  post_count: 'Post count (ea)',
  deck_sqft: 'Deck area (sqft)',
  railing_lf: 'Railing length (lf)',
  stair_count: 'Stair count (ea)',
  roof_sqft: 'Roof area (sqft)',
  fence_length_ft: 'Fence length (lf)',
  fence_gate_count: 'Gate count (ea)'
};

export default function LaborPlanner({
  projectId,
  templates,
  defaultPlan
}: {
  projectId: string;
  templates: any[];
  defaultPlan: any | null;
}) {
  const [selected, setSelected] = useState<string>(templates[0]?.id ?? 'default');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [plan, setPlan] = useState(defaultPlan);

  async function generate() {
    const res = await fetch(`/api/labor/${projectId}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: selected, include_demo: includeDemo })
    });
    const data = await res.json();
    setPlan(data);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 grid gap-4 sm:grid-cols-3">
        <label>
          <p className="label">Template</p>
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
          <span className="label !mt-0">Include Demo</span>
        </label>
        <div className="flex items-end">
          <button onClick={generate} className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Generate Labor Plan</button>
        </div>
      </div>

      {plan && (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Task', 'Driver', 'Qty', 'Hours', 'Rate', 'Cost'].map((h) => (
                  <th className="px-3 py-2 text-left" key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(plan.tasks ?? []).map((task: any) => (
                <tr key={task.key} className="border-t border-slate-200">
                  <td className="px-3 py-2">{task.task}</td>
                  <td className="px-3 py-2">{DRIVER_LABELS[task.quantity_driver] ?? task.quantity_driver}</td>
                  <td className="px-3 py-2">{task.quantity}</td>
                  <td className="px-3 py-2">{task.hours}</td>
                  <td className="px-3 py-2">{money(task.rate)}</td>
                  <td className="px-3 py-2">{money(task.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm font-semibold">
            <span>Total hours: {plan.total_hours}</span>
            <span>Total labor: {money(plan.total_labor_cost)}</span>
          </div>
        </div>
      )}

      {plan ? (
        <a href={`/projects/${projectId}/estimate`} className="inline-block rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Continue to Estimate</a>
      ) : (
        <p className="text-sm text-slate-500">Generate labor plan to continue.</p>
      )}
    </div>
  );
}
