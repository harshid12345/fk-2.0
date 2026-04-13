// WWS (Woningwaarderingsstelsel) Points Calculator
// Simplified version for landlord dashboard

export interface WWScalcInput {
  surface_m2: number;
  building_year: number;
  energy_label: string;
  accommodation_type: 'independent' | 'shared';
}

export interface WWScalcResult {
  total_points: number;
  max_rent: number;
  breakdown: {
    surface_points: number;
    energy_points: number;
    year_points: number;
    base_points: number;
  };
}

const ENERGY_LABEL_POINTS: Record<string, number> = {
  'A+++++': 52, 'A++++': 48, 'A+++': 44, 'A++': 40, 'A+': 36, 'A': 32,
  'B': 22, 'C': 15, 'D': 11, 'E': 5, 'F': 1, 'G': 0,
};

// 2024 rent price per point (approximate)
const RENT_PER_POINT_INDEPENDENT = 5.44;
const RENT_PER_POINT_SHARED = 5.44;
const LIBERALIZATION_THRESHOLD = 879.66; // 2024 threshold

export function calculateWWS(input: WWScalcInput): WWScalcResult {
  // Surface points: 1 point per m² (simplified)
  const surface_points = Math.round(input.surface_m2);

  // Energy label points
  const energy_points = ENERGY_LABEL_POINTS[input.energy_label?.toUpperCase()] ?? 0;

  // Building year points (newer = more points, simplified)
  let year_points = 0;
  if (input.building_year >= 2002) year_points = 22;
  else if (input.building_year >= 1984) year_points = 15;
  else if (input.building_year >= 1970) year_points = 10;
  else if (input.building_year >= 1945) year_points = 5;
  else year_points = 2;

  // Base points for independent vs shared
  const base_points = input.accommodation_type === 'independent' ? 15 : 5;

  const total_points = surface_points + energy_points + year_points + base_points;
  const rent_per_point = input.accommodation_type === 'independent' 
    ? RENT_PER_POINT_INDEPENDENT 
    : RENT_PER_POINT_SHARED;
  const max_rent = Math.round(total_points * rent_per_point * 100) / 100;

  return {
    total_points,
    max_rent,
    breakdown: { surface_points, energy_points, year_points, base_points },
  };
}

export function getComplianceStatus(rent: number, maxRent: number): 'compliant' | 'at_risk' | 'over_limit' {
  if (rent <= maxRent * 0.9) return 'compliant';
  if (rent <= maxRent) return 'at_risk';
  return 'over_limit';
}

export const LIBERALIZATION_LIMIT = LIBERALIZATION_THRESHOLD;
