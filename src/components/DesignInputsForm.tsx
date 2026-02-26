import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { designInputsSchema } from '@/lib/types/schemas';
import type { DesignInputs, ProjectType } from '@/lib/types/domain';
import { z } from 'zod';
import DeckShapeDrawer from './DeckShapeDrawer';
import { useEffect, useState } from 'react';

type FormData = z.infer<typeof designInputsSchema>;

export default function DesignInputsForm({
  projectId,
  defaults,
  projectType
}: {
  projectId: string;
  defaults: DesignInputs;
  projectType: ProjectType;
}) {
  const { register, handleSubmit, watch, setValue, setError, clearErrors, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(designInputsSchema),
    defaultValues: defaults
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isCovered = watch('is_covered');
  const shapeMode = watch('shape_mode') ?? 'rectangle';
  const polygonPoints = watch('deck_polygon_points') ?? [];
  const designMode = watch('design_mode') ?? (projectType === 'fence' ? 'fence' : 'deck');
  const deckingMaterial = watch('decking_material');

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
      deck_polygon_points: defaults.deck_polygon_points ?? [],
      deck_area_override_sqft: defaults.deck_area_override_sqft ?? null,
      deck_perimeter_override_lf: defaults.deck_perimeter_override_lf ?? null
    } as FormData;
    reset(normalized);
  }, [defaults, projectType, reset]);

  useEffect(() => {
    if (shapeMode === 'rectangle') {
      clearErrors('deck_polygon_points');
    }
  }, [shapeMode, clearErrors]);

  useEffect(() => {
    if (designMode === 'deck' && deckingMaterial === 'composite') {
      setValue('joist_spacing_in', 12, { shouldDirty: true });
    }
  }, [designMode, deckingMaterial, setValue]);

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

    if (payload.shape_mode !== 'polygon') {
      payload.deck_area_override_sqft = null;
      payload.deck_perimeter_override_lf = null;
    }

    const res = await fetch(`/api/projects/${projectId}/inputs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
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
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('is_covered')} />
        <span className="label !mt-0">Covered Deck Add-on</span>
      </label>

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
              onChange={(next, areaSqft, perimeterLf) => {
                setValue('deck_polygon_points', next, { shouldDirty: true });
                setValue('deck_area_override_sqft', areaSqft > 0 ? areaSqft : null, { shouldDirty: true });
                setValue('deck_perimeter_override_lf', perimeterLf > 0 ? perimeterLf : null, { shouldDirty: true });
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
            <p className="label">Roof Type</p>
            <select className="input" {...register('roof_type')}>
              <option value="shed">Shed</option>
              <option value="gable">Gable</option>
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
            <p className="label">Ceiling Finish</p>
            <select className="input" {...register('ceiling_finish')}>
              <option value="none">None</option>
              <option value="drywall">Drywall</option>
              <option value="tongue_groove">Tongue &amp; groove</option>
            </select>
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
          <label>
            <p className="label">Fence Length (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_length_ft')} />
          </label>
          <label>
            <p className="label">Fence Height (ft)</p>
            <input className="input" type="number" step="0.1" {...register('fence_height_ft')} />
          </label>
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
