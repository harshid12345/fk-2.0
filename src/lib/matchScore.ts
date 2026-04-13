// Match Score Algorithm — shared between frontend and edge function logic

export interface MatchResult {
  score: number;
  label: string;
  hardDisqualified: boolean;
  hardDisqualifyReason: string | null;
  breakdown: {
    preferenceScore: number;
    financialScore: number;
    scrapedScore: number;
  };
  flags: string[];
}

export function getIncomeEstimate(range: string | null): number {
  switch (range) {
    case 'Under €1,500': return 1250;
    case '€1,500 - €2,500': return 2000;
    case '€2,500 - €3,500': return 3000;
    case '€3,500 - €5,000': return 4250;
    case '€5,000+': return 5500;
    default: return 0;
  }
}

export function getOccupantNumber(text: string | null): number {
  switch (text) {
    case 'Just me': return 1;
    case '2 people': return 2;
    case '3 people': return 3;
    case '4+': return 4;
    default: return 1;
  }
}

export function calculateMatchScore(
  tenant: {
    smoking?: string | null;
    pets?: string | null;
    num_occupants?: string | null;
    desired_move_in?: string | null;
    employment_type?: string | null;
    monthly_income_range?: string | null;
    monthly_income?: number | null;
    bkr_status?: string | null;
    lifestyle_answers?: any;
  },
  criteria: {
    smoking_allowed?: string | null;
    pets_allowed?: string | null;
    max_occupants?: number | null;
    min_income?: number | null;
  },
  propertyRent: number,
  scrapeData: any | null
): MatchResult {
  const flags: string[] = [];

  // Derive smoking/pets from lifestyle_answers if not top-level
  const smoking = tenant.smoking || tenant.lifestyle_answers?.smoking || null;
  const pets = tenant.pets || tenant.lifestyle_answers?.pets || null;
  const incomeRange = tenant.monthly_income_range || tenant.lifestyle_answers?.income_range || null;
  const incomeEstimate = incomeRange ? getIncomeEstimate(incomeRange) : (tenant.monthly_income || 0);

  // ═══════════════════════════════════════════
  // HARD DISQUALIFIERS
  // ═══════════════════════════════════════════
  const smokingMap: Record<string, string> = { 'smoke_yes': 'Yes', 'smoke_no': 'No', 'smoke_outside': 'Outside only', 'yes': 'Yes', 'no': 'No', 'social': 'Outside only' };
  const resolvedSmoking = smokingMap[smoking?.toLowerCase?.()] || smoking;

  if (criteria.smoking_allowed === 'No' && resolvedSmoking === 'Yes') {
    return {
      score: 0, label: 'Disqualified', hardDisqualified: true,
      hardDisqualifyReason: 'Landlord does not allow smoking — tenant smokes',
      breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
      flags: ['Hard disqualifier: smoking']
    };
  }

  const petsMap: Record<string, string> = { 'none': 'No pets', 'cat': 'Cat', 'dog': 'Dog', 'other': 'Other', 'pets_none': 'No pets', 'pets_cat': 'Cat', 'pets_dog': 'Dog', 'pets_other': 'Other' };
  const resolvedPets = petsMap[pets?.toLowerCase?.()] || pets;

  if (criteria.pets_allowed === 'No' && resolvedPets !== 'No pets' && resolvedPets) {
    return {
      score: 0, label: 'Disqualified', hardDisqualified: true,
      hardDisqualifyReason: 'Landlord does not allow pets — tenant has pets',
      breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
      flags: ['Hard disqualifier: pets']
    };
  }

  if (incomeEstimate > 0 && incomeEstimate < propertyRent * 2) {
    return {
      score: 0, label: 'Disqualified', hardDisqualified: true,
      hardDisqualifyReason: 'Income below 2x monthly rent',
      breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
      flags: ['Hard disqualifier: income too low']
    };
  }

  if (tenant.bkr_status === 'Yes, I can explain') {
    return {
      score: 0, label: 'Disqualified', hardDisqualified: true,
      hardDisqualifyReason: 'Self-reported BKR registration or rent arrears',
      breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
      flags: ['Hard disqualifier: BKR/arrears']
    };
  }

  // ═══════════════════════════════════════════
  // BLOCK 1: PREFERENCE MATCH (max 4.0)
  // ═══════════════════════════════════════════
  let preferenceScore = 0;

  if (criteria.smoking_allowed === 'Yes' || resolvedSmoking === 'No') {
    preferenceScore += 1;
  } else if (criteria.smoking_allowed === 'Outside only' && resolvedSmoking === 'Outside only') {
    preferenceScore += 1;
  } else {
    preferenceScore -= 1;
    flags.push('Smoking preference mismatch');
  }

  if (criteria.pets_allowed === 'Yes' || resolvedPets === 'No pets' || !resolvedPets) {
    preferenceScore += 1;
  } else if (criteria.pets_allowed === 'Negotiable') {
    preferenceScore += 0.5;
    flags.push('Tenant has pets — landlord says negotiable');
  } else {
    preferenceScore -= 1;
    flags.push('Pets preference mismatch');
  }

  const tenantOccupants = getOccupantNumber(tenant.num_occupants || null);
  if (tenantOccupants <= (criteria.max_occupants || 1)) {
    preferenceScore += 1;
  } else {
    preferenceScore -= 1;
    flags.push('Too many occupants for this property');
  }

  if (tenant.desired_move_in === 'This month' || tenant.desired_move_in === 'Next month') {
    preferenceScore += 1;
  } else if (tenant.desired_move_in === 'Flexible') {
    preferenceScore += 0.5;
  } else {
    preferenceScore -= 0.5;
    flags.push('Move-in date may not align');
  }

  preferenceScore = Math.max(0, Math.min(4, preferenceScore));

  // ═══════════════════════════════════════════
  // BLOCK 2: FINANCIAL RELIABILITY (max 4.0)
  // ═══════════════════════════════════════════
  let financialScore = 0;

  const incomeRatio = propertyRent > 0 ? incomeEstimate / propertyRent : 0;
  if (incomeRatio >= 3) financialScore += 2.0;
  else if (incomeRatio >= 2.5) financialScore += 1.0;

  const empType = tenant.employment_type || tenant.lifestyle_answers?.employment_type;
  switch (empType) {
    case 'Loondienst (employed)':
      financialScore += 1.0;
      break;
    case 'ZZP (self-employed)':
      if (scrapeData?.kvk?.yearsActive >= 2) {
        financialScore += 0.75;
      } else {
        financialScore += 0.25;
      }
      break;
    case 'Student':
    case 'Uitkering (benefits)':
      financialScore += 0.25;
      flags.push('Employment type: limited financial stability signal');
      break;
    default:
      financialScore += 0.25;
  }

  // Clean BKR
  financialScore += 0.5;

  financialScore = Math.max(0, Math.min(4, financialScore));

  // ═══════════════════════════════════════════
  // BLOCK 3: SCRAPED DATA SIGNALS (max 2.0)
  // ═══════════════════════════════════════════
  let scrapedScore = 0;

  if (scrapeData) {
    if (scrapeData.linkedin?.confirmsEmployer) scrapedScore += 0.5;
    if (scrapeData.kvk?.confirmed) scrapedScore += 0.5;
    if (scrapeData.socialConsistent) scrapedScore += 0.25;
    if (scrapeData.socialAccountAge >= 2) scrapedScore += 0.25;
    if (scrapeData.google?.noNegativeResults) {
      scrapedScore += 0.5;
    } else if (scrapeData.google?.negativeResults) {
      scrapedScore -= 0.5;
      flags.push('Negative mentions found in public search results');
    }
    if (scrapeData.hibp?.flagged) {
      scrapedScore -= 0.5;
      flags.push('Email found in data breach records');
    }
    if (scrapeData.socialInconsistent) {
      scrapedScore -= 0.5;
      flags.push('Social media profiles inconsistent with stated information');
    }
  } else {
    scrapedScore = 1.0;
  }

  scrapedScore = Math.max(0, Math.min(2, scrapedScore));

  // ═══════════════════════════════════════════
  // FINAL SCORE
  // ═══════════════════════════════════════════
  const totalScore = Math.round((preferenceScore + financialScore + scrapedScore) * 10) / 10;

  let label: string;
  if (totalScore >= 8.5) label = 'Strong match';
  else if (totalScore >= 6.5) label = 'Good match';
  else if (totalScore >= 4.5) label = 'Moderate match';
  else label = 'Weak match';

  return {
    score: totalScore,
    label,
    hardDisqualified: false,
    hardDisqualifyReason: null,
    breakdown: { preferenceScore, financialScore, scrapedScore },
    flags
  };
}
