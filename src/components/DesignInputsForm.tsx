import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { designInputsSchema } from '@/lib/types/schemas';
import type { DesignInputs, ProjectType } from '@/lib/types/domain';
import { z } from 'zod';
import DeckShapeDrawer from './DeckShapeDrawer';
import { useEffect, useState } from 'react';
import { validateCoveredPackage } from '@/lib/engines/covered';

type FormData = z.infer<typeof designInputsSchema>;

export default function DesignInputsForm({
  projectId,
  defaults,
  projectType,
  requireCompleteCoveredPackageDefault = false
}: {
  projectId: string;
  defaults: DesignInputs;
  projectType: ProjectType;
  requireCompleteCoveredPackageDefault?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, setError, clearErrors, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(designInputsSchema),
    defaultValues: defaults
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requireCompleteCoveredPackage, setRequireCompleteCoveredPackage] = useState<boolean>(requireCompleteCoveredPackageDefault);

  const isCovered = watch('is_covered');
  const shapeMode = watch('shape_mode') ?? 'rectangle';
  const polygonPoints = watch('deck_polygon_points') ?? [];
  const ledgerLineIndex = watch('ledger_line_index');
  const ledgerEnabled = watch('ledger');
  const designMode = watch('design_mode') ?? (projectType === 'fence' ? 'fence' : 'deck');
  const deckingMaterial = watch('decking_material');
  const roofingMaterial = watch('roofing_material') ?? 'shingle';
  const roofType = watch('roof_type') ?? 'shed';
  const roofPitch = watch('roof_pitch') ?? '4:12';
  const roofLength = Number(watch('roof_length_ft') ?? 0);
  const roofWidth = Number(watch('roof_width_ft') ?? 0);
  const roofingType = String(watch('roofing_product_type') ?? '').trim();
  const roofingColor = String(watch('roofing_color') ?? '').trim();
  const ceilingFinish = watch('ceiling_finish') ?? 'none';
  const fanPlates = Number(watch('ceiling_fan_plate_count') ?? 0);
  const coverPosts = Number(watch('cover_post_count') ?? 0);
  const coverBeamSize = String(watch('cover_beam_size') ?? '').trim();
  const fenceLayout = watch('fence_layout') ?? 'straight';
  const fenceSideA = Number(watch('fence_side_a_ft') ?? 0);
  const fenceSideB = Number(watch('fence_side_b_ft') ?? 0);
  const fenceSideC = Number(watch('fence_side_c_ft') ?? 0);
  const coveredValidation = validateCoveredPackage({
    roof_type: roofType as any,
    roof_pitch: roofPitch as any,
    roof_length_ft: roofLength,
    roof_width_ft: roofWidth,
    roofing_material: roofingMaterial as any,
    roofing_product_type: roofingType,
    roofing_color: roofingColor,
    ceiling_finish: ceilingFinish as any,
    cover_post_count: coverPosts,
    cover_beam_size: coverBeamSize
  });
  const coveredChecklist = [
    { key: 'roof_style', label: 'Roof style', ok: !coveredValidation.missing.includes('Roof style') },
    { key: 'roof_pitch', label: 'Roof pitch', ok: !coveredValidation.missing.includes('Roof pitch') },
    { key: 'roof_dims', label: 'Roof length + width', ok: !coveredValidation.missing.includes('Roof length + width') },
    { key: 'roof_material', label: 'Roofing material + type', ok: !coveredValidation.missing.includes('Roofing material + type') },
    { key: 'roof_color', label: 'Roof color', ok: !coveredValidation.missing.includes('Roof color') },
    { key: 'ceiling', label: 'Ceiling finish', ok: !coveredValidation.missing.includes('Ceiling finish') },
    { key: 'cover_posts', label: 'Cover post count', ok: !coveredValidation.missing.includes('Cover post count') },
    { key: 'cover_beam', label: 'Cover beam size', ok: !coveredValidation.missing.includes('Cover beam size') }
  ];
  const coveredCompleteCount = coveredChecklist.filter((item) => item.ok).length;
  const coveredIsReady = coveredValidation.ready;
  const roofArea = roofLength > 0 && roofWidth > 0 ? roofLength * roofWidth : 0;

  useEffect(() => {
    register('deck_polygon_points');
  }, [register]);

  useEffect(() => {
    setValue('design_mode', projectType === 'fence' ? 'fence' : 'deck', { shouldDirty: false });
  }, [projectType, setValue]);

  useEffect(() => {
    const normalized: FormData = {
      ...defaults,
      design_mode: projectType === 'fence' ? 'fence' : 'deck',
      shape_mode: defaults.shape_mode ?? ((defaults.deck_polygon_points?.length ?? 0) > 0 ? 'polygon' : 'rectangle'),
      ledger_side: defaults.ledger_side ?? 'top',
      deck_polygon_points: defaults.deck_polygon_points ?? [],
      ledger_line_index: defaults.ledger_line_index ?? null,
      deck_area_override_sqft: defaults.deck_area_override_sqft ?? null,
      deck_perimeter_override_lf: defaults.deck_perimeter_override_lf ?? null
    } as FormData;
    reset(normalized);
  }, [defaults, projectType, reset]);

  useEffect(() => {
    setRequireCompleteCoveredPackage(requireCompleteCoveredPackageDefault);
  }, [requireCompleteCoveredPackageDefault]);

  useEffect(() => {
    if (shapeMode === 'rectangle') {
      clearErrors('deck_polygon_points');
    }
  }, [shapeMode, clearErrors]);

  useEffect(() => {
    if (shapeMode !== 'polygon' || !ledgerEnabled) return;
    if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) {
      setValue('ledger_line_index', null, { shouldDirty: true });
      return;
    }
    const current = typeof ledgerLineIndex === 'number' ? ledgerLineIndex : Number(ledgerLineIndex);
    if (!Number.isFinite(current) || current < 0 || current >= polygonPoints.length) {
      setValue('ledger_line_index', 0, { shouldDirty: true });
    }
  }, [shapeMode, polygonPoints, ledgerLineIndex, setValue, ledgerEnabled]);

  useEffect(() => {
    if (designMode === 'deck' && deckingMaterial === 'composite') {
      setValue('joist_spacing_in', 12, { shouldDirty: true });
    }
  }, [designMode, deckingMaterial, setValue]);

  function applyFencePreset(preset: 'straight' | 'corner' | 'u_shape') {
    setValue('fence_layout', preset, { shouldDirty: true });
    if (preset === 'straight') {
      setValue('fence_side_a_ft', null, { shouldDirty: true });
      setValue('fence_side_b_ft', null, { shouldDirty: true });
      setValue('fence_side_c_ft', null, { shouldDirty: true });
      return;
    }
    if (preset === 'corner') {
      setValue('fence_side_a_ft', fenceSideA > 0 ? fenceSideA : 40, { shouldDirty: true });
      setValue('fence_side_b_ft', fenceSideB > 0 ? fenceSideB : 30, { shouldDirty: true });
      setValue('fence_side_c_ft', null, { shouldDirty: true });
      return;
    }
    setValue('fence_side_a_ft', fenceSideA > 0 ? fenceSideA : 30, { shouldDirty: true });
    setValue('fence_side_b_ft', fenceSideB > 0 ? fenceSideB : 20, { shouldDirty: true });
    setValue('fence_side_c_ft', fenceSideC > 0 ? fenceSideC : 30, { shouldDirty: true });
  }

  function recalcFenceLengthFromSides() {
    if (fenceLayout === 'corner') {
      const total = Math.max(0, fenceSideA) + Math.max(0, fenceSideB);
      if (total > 0) setValue('fence_length_ft', Number(total.toFixed(2)), { shouldDirty: true });
      return;
    }
    if (fenceLayout === 'u_shape') {
      const total = Math.max(0, fenceSideA) + Math.max(0, fenceSideB) + Math.max(0, fenceSideC);
      if (total > 0) setValue('fence_length_ft', Number(total.toFixed(2)), { shouldDirty: true });
    }
  }

  async function onSubmit(values: FormData) {
    setSubmitError(null);
    if (values.shape_mode === 'polygon' && (values.deck_polygon_points?.length ?? 0) < 3) {
      setError('deck_polygon_points', { type: 'manual', message: 'Add at least 3 points to form a polygon.' });
      return;
    }
    clearErrors('deck_polygon_points');

    const payload = {
      ...values,
      shape_mode: values.shape_mode ?? shapeMode,
      deck_polygon_points: values.shape_mode === 'polygon' ? (values.deck_polygon_points ?? polygonPoints) : [],
      deck_area_override_sqft: values.deck_area_override_sqft ?? null,
      deck_perimeter_override_lf: values.deck_perimeter_override_lf ?? null
    };

    if (payload.design_mode === 'deck' && payload.decking_material === 'composite') {
      payload.joist_spacing_in = 12;
    }

    if (requireCompleteCoveredPackage && payload.design_mode === 'deck' && payload.is_covered) {
      const validation = validateCoveredPackage(payload);
      if (!validation.ready) {
        setSubmitError(`Covered package required before continue. Missing: ${validation.missing.join(', ')}`);
        return;
      }
    }

    if (payload.shape_mode !== 'polygon') {
      payload.ledger_line_index = null;
      payload.deck_area_override_sqft = null;
      payload.deck_perimeter_override_lf = null;
    }

    if (payload.design_mode === 'fence') {
      if (payload.fence_layout === 'corner') {
        const total = Number(payload.fence_side_a_ft ?? 0) + Number(payload.fence_side_b_ft ?? 0);
        if (Number.isFinite(total) && total > 0) payload.fence_length_ft = Number(total.toFixed(2));
      } else if (payload.fence_layout === 'u_shape') {
        const total = Number(payload.fence_side_a_ft ?? 0) + Number(payload.fence_side_b_ft ?? 0) + Number(payload.fence_side_c_ft ?? 0);
        if (Number.isFinite(total) && total > 0) payload.fence_length_ft = Number(total.toFixed(2));
      }
    }

    const res = await fetch(`/api/projects/${projectId}/inputs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        require_complete_covered_package: requireCompleteCoveredPackage
      })
    });
    if (!res.ok) {
      const message = await res.text();
      setSubmitError(message || 'Failed to save inputs');
      return;
    }
    window.location.href = `/projects/${projectId}/takeoff`;
  }

  return (
    <form className="card grid gap-4 p-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register('design_mode')} />

      {designMode === 'deck' && (
        <>
      <label>
        <p className="label">Deck Length (ft)</p>
        <input className="input" type="number" step="0.1" {...register('deck_length_ft')} />
      </label>
      <label>
        <p className="label">Deck Width (ft)</p>
        <input className="input" type="number" step="0.1" {...register('deck_width_ft')} />
      </label>
      <label>
        <p className="label">Deck Height (ft)</p>
        <input className="input" type="number" step="0.1" {...register('deck_height_ft')} />
      </label>
      <label>
        <p className="label">Decking Material</p>
        <select className="input" {...register('decking_material')}>
          <option value="wood">Wood</option>
          <option value="composite">Composite</option>
        </select>
      </label>
      <label>
        <p className="label">Joist Spacing (in)</p>
        <select className="input" {...register('joist_spacing_in')} disabled={deckingMaterial === 'composite'}>
          <option value={12}>12</option>
          <option value={16}>16</option>
          <option value={24}>24</option>
        </select>
        {deckingMaterial === 'composite' && (
          <p className="mt-1 text-xs text-slate-500">Composite decking forces 12&quot; O.C. joist spacing.</p>
        )}
      </label>
      <label>
        <p className="label">Beam Count (Support Beam Lines)</p>
        <input className="input" type="number" {...register('beam_count')} />
        <p className="mt-1 text-xs text-slate-500">
          Number of under-deck support beam lines. This is not the outside rim/edge board.
        </p>
      </label>
      <label>
        <p className="label">Post Spacing (ft)</p>
        <input className="input" type="number" step="0.1" {...register('post_spacing_ft')} />
      </label>
      <label>
        <p className="label">Stair Count</p>
        <input className="input" type="number" {...register('stair_count')} />
      </label>
      <label>
        <p className="label">Stair Width (ft)</p>
        <input className="input" type="number" step="0.1" {...register('stair_width_ft')} />
      </label>
      <label>
        <p className="label">Railing Type</p>
        <select className="input" {...register('railing_type')}>
          <option value="none">No railing</option>
          <option value="wood">Wood</option>
          <option value="aluminum">Aluminum</option>
          <option value="cable">Cable</option>
        </select>
      </label>
      <label>
        <p className="label">Railing Sides</p>
        <select className="input" {...register('railing_sides')}>
          <option value="all">All</option>
          <option value="3_sides">3 sides</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>
        <p className="label">Custom Railing LF</p>
        <input className="input" type="number" step="0.1" {...register('custom_railing_lf')} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('ledger')} />
        <span className="label !mt-0">Ledger</span>
      </label>
      {watch('ledger') && (
        <label>
          <p className="label">Ledger Side (House Side)</p>
          <select className="input" {...register('ledger_side')}>
            <option value="top">Top (default)</option>
            <option value="right">Right</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Choose where the house/ledger connection is located for railing and diagram logic.
          </p>
        </label>
      )}
      {watch('ledger') && shapeMode === 'polygon' && (
        <div className="rounded-md border border-slate-200 p-3">
          <p className="label">Ledger Line (Polygon Edge)</p>
          <p className="mt-1 text-sm text-slate-700">
            {polygonPoints.length >= 3 && Number.isFinite(Number(ledgerLineIndex))
              ? `Selected: Edge ${Number(ledgerLineIndex) + 1}`
              : 'Selected: none'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Click an edge in the polygon canvas below to choose the house ledger line.
          </p>
        </div>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('is_covered')} />
        <span className="label !mt-0">Covered Deck Add-on</span>
      </label>
      {isCovered && (
        <div className="surface-muted sm:col-span-2 rounded-lg p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label !mt-0">Covered Package Readiness</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                coveredIsReady
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
            >
              {coveredIsReady ? 'Ready for Takeoff' : `Missing ${coveredChecklist.length - coveredCompleteCount}`}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <p className="text-slate-500">Roof Package</p>
              <p className="font-semibold">{roofType === 'gable' ? 'Gable' : 'Lean-to'} • {roofPitch}</p>
            </div>
            <div className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <p className="text-slate-500">Roofing</p>
              <p className="font-semibold">{roofingMaterial} {roofingType ? `• ${roofingType}` : ''}</p>
            </div>
            <div className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <p className="text-slate-500">Roof Area</p>
              <p className="font-semibold">{roofArea > 0 ? `${roofArea.toFixed(0)} sqft` : 'Add roof dimensions'}</p>
            </div>
            <div className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
              <p className="text-slate-500">Ceiling/Fans</p>
              <p className="font-semibold">{ceilingFinish}{fanPlates > 0 ? ` • fan plates ${fanPlates}` : ''}</p>
            </div>
          </div>
          {!coveredIsReady && (
            <p className="mt-2 text-xs text-slate-500">
              Missing: {coveredChecklist.filter((item) => !item.ok).map((item) => item.label).join(', ')}.
            </p>
          )}
        </div>
      )}
      {designMode === 'deck' && (
        <div className="surface-muted sm:col-span-2 rounded-lg p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireCompleteCoveredPackage}
              onChange={(event) => setRequireCompleteCoveredPackage(event.target.checked)}
            />
            <span className="label !mt-0">Require complete covered package before continue</span>
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Project-level setting. When enabled, covered-deck inputs must include full roof/ceiling package fields before Save Inputs + Continue.
          </p>
        </div>
      )}

      <div className="surface-muted sm:col-span-2 rounded-lg p-3">
        <p className="label">Deck Shape</p>
        <p className="text-xs text-slate-500">Use rectangle fields above or switch to polygon to draw custom shapes (L-shape, etc).</p>
        <div className="mt-2 flex gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="rectangle" {...register('shape_mode')} />
            Rectangle
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="polygon" {...register('shape_mode')} />
            Polygon / L-shape
          </label>
        </div>

        {shapeMode === 'polygon' && (
          <div className="mt-3">
            <DeckShapeDrawer
              points={polygonPoints}
              selectedLedgerEdgeIndex={typeof ledgerLineIndex === 'number' ? ledgerLineIndex : (ledgerLineIndex == null ? null : Number(ledgerLineIndex))}
              onSelectLedgerEdge={(index) => {
                setValue('ledger_line_index', index, { shouldDirty: true });
              }}
              onChange={(next, areaSqft, perimeterLf) => {
                setValue('deck_polygon_points', next, { shouldDirty: true });
                setValue('deck_area_override_sqft', areaSqft > 0 ? areaSqft : null, { shouldDirty: true });
                setValue('deck_perimeter_override_lf', perimeterLf > 0 ? perimeterLf : null, { shouldDirty: true });
                if ((ledgerEnabled ?? false) && next.length >= 3) {
                  const current = typeof ledgerLineIndex === 'number' ? ledgerLineIndex : Number(ledgerLineIndex);
                  if (!Number.isFinite(current) || current < 0 || current >= next.length) {
                    setValue('ledger_line_index', 0, { shouldDirty: true });
                  }
                } else {
                  setValue('ledger_line_index', null, { shouldDirty: true });
                }
              }}
            />
            {errors.deck_polygon_points && (
              <p className="mt-2 text-xs font-semibold text-rose-500">{errors.deck_polygon_points.message?.toString()}</p>
            )}
          </div>
        )}

        <input type="hidden" {...register('deck_area_override_sqft')} />
        <input type="hidden" {...register('deck_perimeter_override_lf')} />
      </div>

      {isCovered && (
        <>
          <label>
            <p className="label">Roof Style</p>
            <select className="input" {...register('roof_type')}>
              <option value="shed">Lean-to (Shed)</option>
              <option value="gable">Gable</option>
            </select>
          </label>
          <label>
            <p className="label">Roof Pitch</p>
            <select className="input" {...register('roof_pitch')}>
              <option value="2:12">2:12</option>
              <option value="3:12">3:12</option>
              <option value="4:12">4:12</option>
              <option value="5:12">5:12</option>
              <option value="6:12">6:12</option>
              <option value="8:12">8:12</option>
              <option value="10:12">10:12</option>
              <option value="12:12">12:12</option>
            </select>
          </label>
          <label>
            <p className="label">Roof Length (ft)</p>
            <input className="input" type="number" step="0.1" {...register('roof_length_ft')} />
          </label>
          <label>
            <p className="label">Roof Width (ft)</p>
            <input className="input" type="number" step="0.1" {...register('roof_width_ft')} />
          </label>
          <label>
            <p className="label">Rafter Spacing (in)</p>
            <select className="input" {...register('rafter_spacing_in')}>
              <option value={12}>12</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
            </select>
          </label>
          <label>
            <p className="label">Roofing Material</p>
            <select className="input" {...register('roofing_material')}>
              <option value="shingle">Shingle</option>
              <option value="metal">Metal</option>
            </select>
          </label>
          <label>
            <p className="label">{roofingMaterial === 'metal' ? 'Metal Roof Type' : 'Shingle Type'}</p>
            {roofingMaterial === 'metal' ? (
              <select className="input" {...register('roofing_product_type')}>
                <option value="standing_seam">Standing Seam</option>
                <option value="r_panel">R-Panel</option>
                <option value="corrugated">Corrugated</option>
              </select>
            ) : (
              <select className="input" {...register('roofing_product_type')}>
                <option value="architectural">Architectural</option>
                <option value="three_tab">3-tab</option>
                <option value="designer">Designer/Luxury</option>
              </select>
            )}
          </label>
          <label>
            <p className="label">Roof Color</p>
            <input className="input" {...register('roofing_color')} placeholder="Charcoal, Bronze, Galvalume..." />
          </label>
          <label>
            <p className="label">Ceiling Finish</p>
            <select className="input" {...register('ceiling_finish')}>
              <option value="none">None</option>
              <option value="drywall">Drywall</option>
              <option value="tongue_groove">Tongue &amp; groove</option>
              <option value="beadboard">Beadboard</option>
            </select>
          </label>
          <label>
            <p className="label">Ceiling Fan Plates (ea)</p>
            <input className="input" type="number" {...register('ceiling_fan_plate_count')} />
            <p className="mt-1 text-xs text-slate-500">Fan-rated ceiling support plates/boxes allowance.</p>
          </label>
          <label>
            <p className="label">Cover Post Count</p>
            <input className="input" type="number" {...register('cover_post_count')} />
          </label>
          <label>
            <p className="label">Cover Beam Size</p>
            <input className="input" {...register('cover_beam_size')} />
          </label>
        </>
      )}
        </>
      )}

      {designMode === 'fence' && (
        <>
          <div className="surface-muted sm:col-span-2 rounded-lg p-3">
            <p className="label">Fence Layout Presets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => applyFencePreset('straight')}>
                Straight Run
              </button>
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => applyFencePreset('corner')}>
                Corner Run (L)
              </button>
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => applyFencePreset('u_shape')}>
                U-Run
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Presets fill segment lengths for faster entry. You can still edit manually.</p>
          </div>
          <label>
            <p className="label">Fence Layout</p>
            <select className="input" {...register('fence_layout')}>
              <option value="straight">Straight</option>
              <option value="corner">Corner (L)</option>
              <option value="u_shape">U-Shape</option>
            </select>
          </label>
          <label>
            <p className="label">Fence Length (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_length_ft')} />
            {(fenceLayout === 'corner' || fenceLayout === 'u_shape') && (
              <p className="mt-1 text-xs text-slate-500">For {fenceLayout === 'corner' ? 'Corner' : 'U-Shape'} layouts, total length can be derived from sides below.</p>
            )}
          </label>
          <label>
            <p className="label">Fence Height (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_height_ft')} />
          </label>
          {(fenceLayout === 'corner' || fenceLayout === 'u_shape') && (
            <>
              <label>
                <p className="label">Side A (ft)</p>
                <input className="input" type="number" step="0.1" {...register('fence_side_a_ft')} />
              </label>
              <label>
                <p className="label">Side B (ft)</p>
                <input className="input" type="number" step="0.1" {...register('fence_side_b_ft')} />
              </label>
              {fenceLayout === 'u_shape' && (
                <label>
                  <p className="label">Side C (ft)</p>
                  <input className="input" type="number" step="0.1" {...register('fence_side_c_ft')} />
                </label>
              )}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={recalcFenceLengthFromSides}
                >
                  Recalculate Total Fence Length
                </button>
              </div>
            </>
          )}
          <label>
            <p className="label">Fence Material</p>
            <select className="input" {...register('fence_material')}>
              <option value="wood">Wood</option>
              <option value="vinyl">Vinyl</option>
              <option value="metal">Metal</option>
            </select>
          </label>
          <label>
            <p className="label">Fence Style</p>
            <select className="input" {...register('fence_style')}>
              <option value="privacy">Privacy</option>
              <option value="picket">Picket</option>
              <option value="panel">Panel</option>
            </select>
          </label>
          <label>
            <p className="label">Post Spacing (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_post_spacing_ft')} />
          </label>
          <label>
            <p className="label">Rail Count</p>
            <input className="input" type="number" {...register('fence_rail_count')} />
          </label>
          <label>
            <p className="label">Picket Width (in)</p>
            <input className="input" type="number" step="0.1" {...register('fence_picket_width_in')} />
          </label>
          <label>
            <p className="label">Picket Gap (in)</p>
            <input className="input" type="number" step="0.1" {...register('fence_picket_gap_in')} />
          </label>
          <label>
            <p className="label">Gate Count</p>
            <input className="input" type="number" {...register('fence_gate_count')} />
          </label>
          <label>
            <p className="label">Gate Width (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_gate_width_ft')} />
          </label>
        </>
      )}

      <div className="sm:col-span-2">
        {submitError && <p className="mb-2 text-xs font-semibold text-rose-500">{submitError}</p>}
        <button className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white">Save Inputs + Continue</button>
      </div>
    </form>
  );
}
