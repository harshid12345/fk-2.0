import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function runApifyActor(actorId: string, input: any, token: string): Promise<any> {
  console.log(`Running Apify actor: ${actorId}`);
  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );
    const runData = await startRes.json();
    console.log(`Actor ${actorId} status:`, runData?.data?.status);
    if (!runData?.data?.defaultDatasetId) {
      console.error('No dataset ID:', runData);
      return null;
    }
    const datasetRes = await fetch(
      `https://api.apify.com/v2/datasets/${runData.data.defaultDatasetId}/items?token=${token}&limit=20`
    );
    const items = await datasetRes.json();
    console.log(`Actor ${actorId} returned ${items?.length || 0} items`);
    return items;
  } catch (err) {
    console.error(`Actor ${actorId} error:`, err);
    return null;
  }
}

// Parse raw handle/URL into a usable identifier for the given platform
function parseHandle(raw: string, platform: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (platform === 'instagram') {
    // Accept "@username", "username", or "instagram.com/username"
    return clean.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, '').split('/')[0] || null;
  }
  if (platform === 'twitter') {
    // Return full URL for actor input
    const handle = clean.replace(/^@/, '').replace(/.*(?:twitter|x)\.com\//, '').replace(/\/$/, '').split('/')[0];
    return handle ? `https://twitter.com/${handle}` : null;
  }
  if (platform === 'facebook') {
    return clean.includes('facebook.com') || clean.includes('fb.com') ? clean : null;
  }
  if (platform === 'linkedin') {
    return clean.includes('linkedin.com') ? clean : null;
  }
  return null;
}

interface ScrapeAnalysis {
  // Core
  profileFound: boolean;
  accountAgeYears: number;
  hasProfilePicAndBio: boolean;
  noNegativeResults: boolean;
  // Instagram
  followerCount?: number;
  postCount?: number;
  // Facebook
  locationMatchesCity?: boolean;
  profileComplete?: boolean;
  // All: lifestyle consistency
  lifestyleConsistent?: boolean;
  // LinkedIn
  employmentMatchesStated?: boolean;
  stableWorkHistory?: boolean;
  educationListed?: boolean;
  // Twitter
  recentlyActive?: boolean;
  contentConsistentWithPersona?: boolean;
  // Red flags
  concerningContentDetected: boolean;
  profileAppearsFakeOrBot: boolean;
  // Legacy fields (kept for backward compat with fallback path)
  profilesFound?: string[];
  socialConsistent?: boolean;
  socialAccountAge?: number;
  confirmsEmployer?: boolean;
  kvkConfirmed?: boolean;
  kvkYearsActive?: number;
  flaggedConcerns?: string[];
  summary: string;
}

function calculateScrapeScore(analysis: ScrapeAnalysis, platform: string | null): number {
  let score = 0;

  // ── Core signals (any platform) ────────────────────────────────────────────
  if (analysis.profileFound) {
    score += 0.15;
    const age = analysis.accountAgeYears ?? 0;
    if (age >= 1) score += 0.10;
    if (age >= 2) score += 0.10; // cumulative: +0.20 at 2yr
    if (age >= 4) score += 0.10; // cumulative: +0.30 at 4yr
    if (analysis.hasProfilePicAndBio) score += 0.10;
  }

  // ── Platform-specific signals ───────────────────────────────────────────────
  switch (platform) {
    case 'linkedin':
      if (analysis.employmentMatchesStated === true)  score += 0.50;
      if (analysis.stableWorkHistory === true)         score += 0.20;
      if (analysis.educationListed === true)           score += 0.10;
      break;
    case 'instagram': {
      const fc = analysis.followerCount ?? 0;
      if (fc >= 50 && fc <= 5000)                      score += 0.15;
      if ((analysis.postCount ?? 0) >= 20)             score += 0.10;
      if (analysis.lifestyleConsistent === true)       score += 0.30;
      break;
    }
    case 'facebook':
      if (analysis.locationMatchesCity === true)       score += 0.20;
      if (analysis.profileComplete === true)           score += 0.10;
      if (analysis.lifestyleConsistent === true)       score += 0.30;
      break;
    case 'twitter':
      if (analysis.recentlyActive === true)            score += 0.15;
      if (analysis.contentConsistentWithPersona === true) score += 0.30;
      break;
    default:
      // Legacy / no-platform fallback — preserves backward-compat scoring
      if (analysis.confirmsEmployer === true)          score += 0.50;
      if (analysis.socialConsistent === true)          score += 0.25;
      if ((analysis.socialAccountAge ?? 0) >= 2)      score += 0.25;
      if (analysis.noNegativeResults === true)         score += 0.50;
      if (analysis.noNegativeResults === false)        score -= 0.50;
      if (analysis.socialConsistent === false)         score -= 0.50;
  }

  // ── Red flags (any platform) ────────────────────────────────────────────────
  if (analysis.concerningContentDetected)              score -= 0.50;
  if (analysis.profileAppearsFakeOrBot)                score -= 0.30;
  // For known platforms, penalise negative Google results
  if (platform !== null && analysis.noNegativeResults === false) score -= 0.50;

  return Math.max(0, Math.min(2.0, score));
}

async function analyseWithAI(
  scrapedData: any,
  tenantInfo: { name: string; city: string; employment: string; handle: string; platform: string | null },
  apiKey: string
): Promise<ScrapeAnalysis> {
  const platformInstructions: Record<string, string> = {
    linkedin: `
- Check if the stated employer (${tenantInfo.employment}) matches any employer on the LinkedIn profile.
- Check if any single job shows a tenure of 2+ years (stableWorkHistory).
- Check whether an education section is present (educationListed).
- employmentMatchesStated: true only if you can confirm the employer listed matches.`,
    instagram: `
- Estimate follower count and post count from the scraped data.
- lifestyleConsistent: true unless you see posts strongly suggesting property-damaging behaviour (large unsupervised parties, substance abuse, vandalism). Normal social life is fine.`,
    facebook: `
- locationMatchesCity: true if the profile lists ${tenantInfo.city} or nearby as location.
- profileComplete: true if the profile has a photo, bio/about section, and some posts.
- lifestyleConsistent: same rule as Instagram — only false for genuine tenancy risks.`,
    twitter: `
- recentlyActive: true if there are tweets in approximately the last 3 months.
- contentConsistentWithPersona: true unless tweets strongly contradict the stated persona or reveal tenancy risks.`,
  };

  const specificInstructions = platform
    ? (platformInstructions[platform] || '')
    : '- This is a name-based search with no platform provided. Use confirmsEmployer, socialConsistent, socialAccountAge, noNegativeResults.';

  const platform = tenantInfo.platform;

  const prompt = `You are analyzing publicly available social media data for a tenant screening application in the Netherlands. The tenant gave full consent for this check under Dutch AVG/GDPR.

Tenant stated info:
- Name: ${tenantInfo.name}
- City: ${tenantInfo.city || 'Netherlands'}
- Employment: ${tenantInfo.employment || 'unknown'}
- Platform shared: ${platform || 'none — name-search fallback'}
- Handle/URL: ${tenantInfo.handle || 'not provided'}

Platform-specific analysis instructions:
${specificInstructions}

Data found by our scrapers:
${JSON.stringify(scrapedData, null, 2)}

General rules:
- profileFound: true if you found a real profile matching this person.
- accountAgeYears: best estimate of account age in years (0 if unknown).
- hasProfilePicAndBio: true if profile has both a photo and a bio/description.
- noNegativeResults: true by default. Only false if there are credible public reports of fraud, eviction, criminal conviction, or property damage.
- concerningContentDetected: only true for GENUINE tenancy risks (not lifestyle choices).
- profileAppearsFakeOrBot: true only if profile has 0 posts + very recent creation + no followers.
- summary: ONE sentence (max 15 words) most relevant for a landlord. Focus on employment confirmation, clean record, or a real red flag.
- flaggedConcerns: ONLY genuine tenancy risks. Never flag name variations, case differences, location history, religion, politics, race, or gender.
- When in doubt, score POSITIVELY.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: 'You are a tenant screening data analyst. Return only valid JSON via the tool call.' },
        { role: 'user', content: prompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'return_analysis',
          description: 'Return the structured analysis of scraped social media data',
          parameters: {
            type: 'object',
            properties: {
              // Core
              profileFound: { type: 'boolean' },
              accountAgeYears: { type: 'number' },
              hasProfilePicAndBio: { type: 'boolean' },
              noNegativeResults: { type: 'boolean' },
              // Instagram
              followerCount: { type: 'number' },
              postCount: { type: 'number' },
              // Facebook
              locationMatchesCity: { type: 'boolean' },
              profileComplete: { type: 'boolean' },
              // All: lifestyle
              lifestyleConsistent: { type: 'boolean' },
              // LinkedIn
              employmentMatchesStated: { type: 'boolean' },
              stableWorkHistory: { type: 'boolean' },
              educationListed: { type: 'boolean' },
              // Twitter
              recentlyActive: { type: 'boolean' },
              contentConsistentWithPersona: { type: 'boolean' },
              // Red flags
              concerningContentDetected: { type: 'boolean' },
              profileAppearsFakeOrBot: { type: 'boolean' },
              // Legacy (fallback path)
              profilesFound: { type: 'array', items: { type: 'string' } },
              socialConsistent: { type: 'boolean' },
              socialAccountAge: { type: 'number' },
              confirmsEmployer: { type: 'boolean' },
              kvkConfirmed: { type: 'boolean' },
              kvkYearsActive: { type: 'number' },
              flaggedConcerns: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
            },
            required: ['profileFound', 'accountAgeYears', 'noNegativeResults', 'concerningContentDetected', 'profileAppearsFakeOrBot', 'summary'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'return_analysis' } },
    }),
  });

  if (!response.ok) {
    console.error('AI gateway error:', response.status, await response.text());
    return { profileFound: false, accountAgeYears: 0, hasProfilePicAndBio: false, noNegativeResults: true, concerningContentDetected: false, profileAppearsFakeOrBot: false, summary: 'Analysis unavailable' };
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      console.error('Failed to parse tool call args');
    }
  }
  const content = result.choices?.[0]?.message?.content;
  if (content) {
    try { return JSON.parse(content); } catch {}
  }
  return { profileFound: false, accountAgeYears: 0, hasProfilePicAndBio: false, noNegativeResults: true, concerningContentDetected: false, profileAppearsFakeOrBot: false, summary: 'Analysis failed' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { applicantId } = await req.json();
    console.log('=== social-media-scrape called for applicant:', applicantId, '===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: applicant, error: appErr } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', applicantId)
      .single();

    if (appErr || !applicant) {
      console.error('Applicant not found:', appErr);
      return new Response(JSON.stringify({ error: 'Applicant not found' }), { status: 404, headers: corsHeaders });
    }

    const { data: property } = await supabase
      .from('landlord_properties')
      .select('city, landlord_id')
      .eq('id', applicant.property_id)
      .single();

    const apifyToken = Deno.env.get('APIFY_TOKEN');
    if (!apifyToken) {
      console.error('APIFY_TOKEN not configured');
      await supabase.from('applicants').update({
        social_scrape_data: { skipped: true, reason: 'Service temporarily unavailable' },
      }).eq('id', applicantId);
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
    }

    const tenantName = applicant.full_name || '';
    const tenantCity = property?.city || 'Netherlands';
    const rawHandle = (applicant.social_handle || '').trim();
    // social_platform is the explicit choice the applicant made: "instagram"|"facebook"|"twitter"|"linkedin"|null
    const socialPlatform: string | null = applicant.social_platform || null;

    const allScrapedData: any = { platform: socialPlatform, providedHandle: rawHandle || null };

    // ── Platform-specific scraping ──────────────────────────────────────────────
    if (socialPlatform === 'instagram') {
      const username = parseHandle(rawHandle, 'instagram');
      if (username) {
        console.log('Running Instagram scraper for:', username);
        const data = await runApifyActor('apify~instagram-profile-scraper', { usernames: [username] }, apifyToken);
        allScrapedData.instagram = data?.[0] || null;
      }
    } else if (socialPlatform === 'facebook') {
      const profileUrl = parseHandle(rawHandle, 'facebook');
      if (profileUrl) {
        console.log('Running Facebook scraper for:', profileUrl);
        const data = await runApifyActor('apify~facebook-profile-scraper', { startUrls: [{ url: profileUrl }] }, apifyToken);
        allScrapedData.facebook = data?.[0] || null;
      } else {
        // Fallback: use name search to find a Facebook URL
        console.log('Running Social Media Finder (FB fallback) for:', tenantName);
        const found = await runApifyActor('tri_angle~social-media-finder', { profileNames: [tenantName], platforms: ['facebook'] }, apifyToken);
        allScrapedData.socialMediaFinder = found;
        const fbUrl = found?.[0]?.facebook || null;
        if (fbUrl) {
          const data = await runApifyActor('apify~facebook-profile-scraper', { startUrls: [{ url: fbUrl }] }, apifyToken);
          allScrapedData.facebook = data?.[0] || null;
        }
      }
    } else if (socialPlatform === 'twitter') {
      const twitterUrl = parseHandle(rawHandle, 'twitter');
      if (twitterUrl) {
        console.log('Running Twitter scraper for:', twitterUrl);
        const data = await runApifyActor('apify~twitter-scraper', { startUrls: [{ url: twitterUrl }], tweetsDesired: 20 }, apifyToken);
        allScrapedData.twitter = data || null;
      }
    } else if (socialPlatform === 'linkedin') {
      const profileUrl = parseHandle(rawHandle, 'linkedin');
      if (profileUrl) {
        console.log('Running LinkedIn scraper for:', profileUrl);
        const data = await runApifyActor('apify~linkedin-profile-scraper', { profileUrls: [profileUrl] }, apifyToken);
        allScrapedData.linkedin = data?.[0] || null;
      }
    } else {
      // No platform provided / "skip" — fall back to generic name search
      console.log('No platform provided — running Social Media Finder for:', tenantName);
      const finderResults = await runApifyActor(
        'tri_angle~social-media-finder',
        { profileNames: [tenantName], platforms: ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter'] },
        apifyToken
      );
      allScrapedData.socialMediaFinder = finderResults;

      // Try Instagram if finder found a handle
      const igResult = finderResults?.find((r: any) => r.instagram);
      let igUsername = igResult?.instagram
        ?.replace('https://instagram.com/', '')
        ?.replace('https://www.instagram.com/', '')
        ?.replace(/\/$/, '');
      if (igUsername) {
        console.log('Running Instagram scraper (from finder):', igUsername);
        const igData = await runApifyActor('apify~instagram-profile-scraper', { usernames: [igUsername] }, apifyToken);
        allScrapedData.instagram = igData?.[0] || null;
      }
    }

    // Always run Google search
    console.log('Running Google search for:', `${tenantName} ${tenantCity}`);
    allScrapedData.google = await runApifyActor(
      'apify~google-search-scraper',
      { queries: `${tenantName} ${tenantCity}`, maxPagesPerQuery: 1, resultsPerPage: 5 },
      apifyToken
    );

    // ── AI Analysis ─────────────────────────────────────────────────────────────
    let analysis: ScrapeAnalysis = {
      profileFound: false,
      accountAgeYears: 0,
      hasProfilePicAndBio: false,
      noNegativeResults: true,
      concerningContentDetected: false,
      profileAppearsFakeOrBot: false,
      summary: 'No analysis available',
    };

    if (lovableApiKey) {
      console.log('Sending to AI for analysis...');
      analysis = await analyseWithAI(allScrapedData, {
        name: tenantName,
        city: tenantCity,
        employment: applicant.employment_type || '',
        handle: rawHandle,
        platform: socialPlatform,
      }, lovableApiKey);
      console.log('AI analysis:', JSON.stringify(analysis));
    }

    // ── Score ───────────────────────────────────────────────────────────────────
    const scrapedScore = calculateScrapeScore(analysis, socialPlatform);
    console.log('=== Scrape score:', scrapedScore, 'platform:', socialPlatform, '===');

    // ── Persist ─────────────────────────────────────────────────────────────────
    await supabase.from('applicants').update({
      social_scrape_data: {
        platform: socialPlatform,
        raw: allScrapedData,
        analysis,
        scrapedScore,
        scrapedAt: new Date().toISOString(),
      },
      scrape_linkedin: socialPlatform === 'linkedin' && allScrapedData.linkedin ? allScrapedData.linkedin : (analysis.confirmsEmployer ? { confirmed: true } : null),
      scrape_facebook: socialPlatform === 'facebook' && allScrapedData.facebook ? allScrapedData.facebook : null,
      scrape_google: { noNegativeResults: analysis.noNegativeResults },
      scrape_kvk: analysis.kvkConfirmed ? { confirmed: true, yearsActive: analysis.kvkYearsActive } : null,
    }).eq('id', applicantId);

    await recalculateMatchScore(supabase, applicantId);

    return new Response(JSON.stringify({
      success: true,
      scrapedScore,
      platform: socialPlatform,
      summary: analysis.summary,
    }), { headers: corsHeaders });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function recalculateMatchScore(supabase: any, applicantId: string) {
  const { data: applicant } = await supabase.from('applicants').select('*').eq('id', applicantId).single();
  if (!applicant) return;
  const { data: property } = await supabase.from('landlord_properties').select('rent_amount').eq('id', applicant.property_id).single();
  if (!property) return;
  const { data: criteria } = await supabase.from('landlord_criteria').select('*').eq('property_id', applicant.property_id).maybeSingle();

  const rent = property.rent_amount || 1000;
  const answers = applicant.lifestyle_answers || {};
  const smoking = applicant.smoking || answers.smoking || null;
  const pets = applicant.pets || answers.pets || null;
  const incomeRange = applicant.monthly_income_range || answers.income_range || null;
  const incomeEstimate = incomeRange ? getIncomeEstimate(incomeRange) : (applicant.monthly_income || 0);
  const flags: string[] = [];

  // Hard disqualifiers
  if (criteria?.smoking_allowed === 'No' && smoking === 'Yes') {
    await supabase.from('applicants').update({ match_score: 0, match_label: 'Disqualified', hard_disqualified: true, hard_disqualify_reason: 'Landlord does not allow smoking', match_flags: ['Hard disqualifier: smoking'] }).eq('id', applicantId);
    return;
  }
  if (criteria?.pets_allowed === 'No' && pets && pets !== 'No pets') {
    await supabase.from('applicants').update({ match_score: 0, match_label: 'Disqualified', hard_disqualified: true, hard_disqualify_reason: 'Landlord does not allow pets', match_flags: ['Hard disqualifier: pets'] }).eq('id', applicantId);
    return;
  }
  if (incomeEstimate > 0 && rent > 0 && incomeEstimate < rent * 2) {
    await supabase.from('applicants').update({ match_score: 0, match_label: 'Disqualified', hard_disqualified: true, hard_disqualify_reason: 'Income below 2x rent', match_flags: ['Hard disqualifier: income'] }).eq('id', applicantId);
    return;
  }
  if (applicant.bkr_status === 'Yes, I can explain') {
    await supabase.from('applicants').update({ match_score: 0, match_label: 'Disqualified', hard_disqualified: true, hard_disqualify_reason: 'BKR/arrears', match_flags: ['Hard disqualifier: BKR'] }).eq('id', applicantId);
    return;
  }

  // Preference block (max 4)
  let pref = 0;
  if (criteria?.smoking_allowed === 'Yes' || smoking === 'No') pref += 1;
  else if (criteria?.smoking_allowed === 'Outside only' && smoking === 'Outside only') pref += 1;
  else { pref -= 1; flags.push('Smoking mismatch'); }
  if (criteria?.pets_allowed === 'Yes' || !pets || pets === 'No pets') pref += 1;
  else if (criteria?.pets_allowed === 'Negotiable') { pref += 0.5; flags.push('Pets negotiable'); }
  else { pref -= 1; flags.push('Pets mismatch'); }
  const occ = getOccupantNumber(applicant.num_occupants);
  if (occ <= (criteria?.max_occupants || 1)) pref += 1; else { pref -= 1; flags.push('Too many occupants'); }
  if (applicant.desired_move_in === 'This month' || applicant.desired_move_in === 'Next month') pref += 1;
  else if (applicant.desired_move_in === 'Flexible') pref += 0.5;
  else { pref -= 0.5; flags.push('Move-in may not align'); }
  pref = Math.max(0, Math.min(4, pref));

  // Financial block (max 4)
  let fin = 0;
  const ratio = rent > 0 ? incomeEstimate / rent : 0;
  if (ratio >= 3) fin += 2.0; else if (ratio >= 2.5) fin += 1.0;
  const hasKvk = applicant.scrape_kvk?.confirmed;
  switch (applicant.employment_type) {
    case 'Loondienst (employed)': fin += 1.0; break;
    case 'ZZP (self-employed)': fin += (hasKvk && applicant.scrape_kvk?.yearsActive >= 2 ? 0.75 : 0.25); break;
    case 'Student': case 'Uitkering (benefits)': fin += 0.25; flags.push('Limited financial stability'); break;
    default: fin += 0.25;
  }
  fin += 0.5; // clean BKR assumed (disqualified above if not)
  fin = Math.max(0, Math.min(4, fin));

  // Scrape block (max 2) — read pre-computed score stored by scrape function
  const scr = Math.max(0, Math.min(2, applicant.social_scrape_data?.scrapedScore ?? 1.0));

  const total = Math.round((pref + fin + scr) * 10) / 10;
  let label: string;
  if (total >= 8.5) label = 'Strong match';
  else if (total >= 6.5) label = 'Good match';
  else if (total >= 4.5) label = 'Moderate match';
  else label = 'Weak match';

  await supabase.from('applicants').update({
    match_score: Math.round(total * 10) / 10,
    match_label: label,
    match_flags: flags,
    hard_disqualified: false,
    hard_disqualify_reason: null,
  }).eq('id', applicantId);
}

function getIncomeEstimate(range: string | null): number {
  switch (range) {
    case 'Under €1,500': return 1250;
    case '€1,500 - €2,500': return 2000;
    case '€2,500 - €3,500': return 3000;
    case '€3,500 - €5,000': return 4250;
    case '€5,000+': return 5500;
    default: return 0;
  }
}

function getOccupantNumber(text: string | null): number {
  switch (text) {
    case 'Just me': return 1; case '2 people': return 2; case '3 people': return 3; case '4+': return 4; default: return 1;
  }
}
