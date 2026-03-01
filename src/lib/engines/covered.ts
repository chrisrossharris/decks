import type { DesignInputs } from '@/lib/types/domain';

export interface CoveredPackageValidation {
  ready: boolean;
  missing: string[];
}

export function validateCoveredPackage(inputs: Partial<DesignInputs>): CoveredPackageValidation {
  const roofType = String(inputs.roof_type ?? '').trim();
  const roofPitch = String(inputs.roof_pitch ?? '').trim();
  const roofLength = Number(inputs.roof_length_ft ?? 0);
  const roofWidth = Number(inputs.roof_width_ft ?? 0);
  const roofingMaterial = String(inputs.roofing_material ?? '').trim();
  const roofingType = String(inputs.roofing_product_type ?? '').trim();
  const roofingColor = String(inputs.roofing_color ?? '').trim();
  const ceilingFinish = String(inputs.ceiling_finish ?? '').trim();
  const coverPostCount = Number(inputs.cover_post_count ?? 0);
  const coverBeamSize = String(inputs.cover_beam_size ?? '').trim();

  const checks = [
    { label: 'Roof style', ok: roofType.length > 0 },
    { label: 'Roof pitch', ok: roofPitch.length > 0 },
    { label: 'Roof length + width', ok: roofLength > 0 && roofWidth > 0 },
    { label: 'Roofing material + type', ok: roofingMaterial.length > 0 && roofingType.length > 0 },
    { label: 'Roof color', ok: roofingColor.length > 0 },
    { label: 'Ceiling finish', ok: ceilingFinish.length > 0 },
    { label: 'Cover post count', ok: coverPostCount > 0 },
    { label: 'Cover beam size', ok: coverBeamSize.length > 0 }
  ];

  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  return {
    ready: missing.length === 0,
    missing
  };
}
