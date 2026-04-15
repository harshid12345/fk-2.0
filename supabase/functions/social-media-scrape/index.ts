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

async function analyseWithAI(scrapedData: any, tenantInfo: any, apiKey: string): Promise<any> {
  const prompt = `You are analyzing publicly available social media data for a tenant screening application in the Netherlands. The tenant gave consent for this check under Dutch AVG/GDPR.

Tenant stated info:
- Name: ${tenantInfo.name}
- City: ${tenantInfo.city || 'Netherlands'}
- Employment: ${tenantInfo.employment || 'unknown'}
- Instagram handle: ${tenantInfo.instagram || 'not provided'}

Data found by our scrapers:
${JSON.stringify(scrapedData, null, 2)}

Analyze ONLY these signals. Return ONLY valid JSON, no other text.

Rules:
- Party photos are NORMAL for people in their 20s. Do NOT flag them.
- Private profiles are FINE. Score them neutral.
- Multiple profiles on the same platform (e.g. two LinkedIn accounts) is COMPLETELY NORMAL. Many people have old accounts, student accounts, or professional vs personal accounts. Do NOT flag this as inconsistent or suspicious.
- Having profiles with different cities, schools, or jobs is NORMAL — people move, change careers, and study abroad. Only flag if the name itself is clearly a different person entirely.
- socialConsistent should be TRUE unless there is strong evidence of deliberate identity fraud (fake name, stolen photos, etc). Normal life changes are NOT inconsistencies.
- Only flag things directly related to tenancy risk: active fraud, property damage history, eviction court records, or criminal convictions.
- NEVER assess based on race, religion, nationality, gender, or political views.
- If very little data was found, say so honestly. Do not invent findings.
- When in doubt, score POSITIVELY. The absence of red flags is a good sign.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: 'You are a tenant screening data analyst. Return only valid JSON.' },
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
              profilesFound: { type: 'array', items: { type: 'string' } },
              socialConsistent: { type: 'boolean' },
              socialAccountAge: { type: 'number' },
              lifestyleCategory: { type: 'string', enum: ['quiet', 'moderate', 'social', 'very_social'] },
              confirmsEmployer: { type: 'boolean' },
              noNegativeResults: { type: 'boolean' },
              kvkConfirmed: { type: 'boolean' },
              kvkYearsActive: { type: 'number' },
              flaggedConcerns: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
            },
            required: ['profilesFound', 'socialConsistent', 'socialAccountAge', 'noNegativeResults', 'summary'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'return_analysis' } },
    }),
  });

  if (!response.ok) {
    console.error('AI gateway error:', response.status, await response.text());
    return { profilesFound: [], socialConsistent: null, socialAccountAge: 0, noNegativeResults: true, summary: 'Analysis unavailable' };
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      console.error('Failed to parse tool call args:', toolCall.function.arguments);
    }
  }
  // Fallback: try content
  const content = result.choices?.[0]?.message?.content;
  if (content) {
    try { return JSON.parse(content); } catch {}
  }
  return { profilesFound: [], socialConsistent: null, socialAccountAge: 0, noNegativeResults: true, summary: 'Analysis failed' };
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

    // Get applicant
    const { data: applicant, error: appErr } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', applicantId)
      .single();

    if (appErr || !applicant) {
      console.error('Applicant not found:', appErr);
      return new Response(JSON.stringify({ error: 'Applicant not found' }), { status: 404, headers: corsHeaders });
    }

    // Get property + landlord's apify token
    const { data: property } = await supabase
      .from('landlord_properties')
      .select('city, landlord_id')
      .eq('id', applicant.property_id)
      .single();

    let apifyToken: string | null = null;
    if (property?.landlord_id) {
      const { data: landlord } = await supabase
        .from('landlords')
        .select('apify_token')
        .eq('id', property.landlord_id)
        .single();
      apifyToken = landlord?.apify_token || null;
    }

    if (!apifyToken) {
      console.log('No Apify token configured, skipping scrape');
      await supabase.from('applicants').update({
        social_scrape_data: { skipped: true, reason: 'No Apify token configured' },
      }).eq('id', applicantId);
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
    }

    const tenantName = applicant.full_name || '';
    const tenantCity = property?.city || 'Netherlands';
    const tenantIG = applicant.social_handle || '';

    const allScrapedData: any = {};

    // SCRAPE 1: Social Media Finder
    console.log('Running Social Media Finder for:', tenantName);
    const finderResults = await runApifyActor(
      'tri_angle~social-media-finder',
      { profileNames: [tenantName], platforms: ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter'] },
      apifyToken
    );
    allScrapedData.socialMediaFinder = finderResults;

    // SCRAPE 2: Instagram Profile
    let igUsername = tenantIG;
    if (!igUsername && finderResults) {
      const igResult = finderResults?.find((r: any) => r.instagram);
      if (igResult?.instagram) {
        igUsername = igResult.instagram
          .replace('https://instagram.com/', '')
          .replace('https://www.instagram.com/', '')
          .replace('/', '');
      }
    }

    if (igUsername) {
      console.log('Running Instagram Profile Scraper for:', igUsername);
      const igResults = await runApifyActor(
        'apify~instagram-profile-scraper',
        { usernames: [igUsername] },
        apifyToken
      );
      allScrapedData.instagram = igResults?.[0] || null;
    }

    // SCRAPE 3: Google Search
    console.log('Running Google Search for:', `${tenantName} ${tenantCity}`);
    const googleResults = await runApifyActor(
      'apify~google-search-scraper',
      { queries: `${tenantName} ${tenantCity}`, maxPagesPerQuery: 1, resultsPerPage: 5 },
      apifyToken
    );
    allScrapedData.google = googleResults;

    // ANALYSE with AI
    let analysis: any = { profilesFound: [], socialConsistent: null, socialAccountAge: 0, noNegativeResults: true, summary: 'No analysis available' };
    if (lovableApiKey) {
      console.log('Sending to AI for analysis...');
      analysis = await analyseWithAI(allScrapedData, {
        name: tenantName,
        city: tenantCity,
        employment: applicant.employment_type,
        instagram: igUsername,
      }, lovableApiKey);
      console.log('AI analysis:', JSON.stringify(analysis));
    }

    // CALCULATE Block 3 Score (max 2.0)
    let scrapedScore = 0;
    if (analysis.confirmsEmployer === true) scrapedScore += 0.5;
    if (analysis.kvkConfirmed === true) scrapedScore += 0.5;
    if (analysis.socialConsistent === true) scrapedScore += 0.25;
    if (analysis.socialAccountAge >= 2) scrapedScore += 0.25;
    if (analysis.noNegativeResults === true) scrapedScore += 0.5;
    if (analysis.noNegativeResults === false) scrapedScore -= 0.5;
    if (analysis.socialConsistent === false) scrapedScore -= 0.5;
    scrapedScore = Math.max(0, Math.min(2, scrapedScore));

    // SAVE to applicant record
    await supabase.from('applicants').update({
      social_scrape_data: {
        raw: allScrapedData,
        analysis,
        scrapedScore,
        scrapedAt: new Date().toISOString(),
      },
      scrape_linkedin: analysis.confirmsEmployer ? { confirmed: true } : null,
      scrape_google: { noNegativeResults: analysis.noNegativeResults },
      scrape_kvk: analysis.kvkConfirmed ? { confirmed: true, yearsActive: analysis.kvkYearsActive } : null,
    }).eq('id', applicantId);

    console.log('=== Scrape complete. Score:', scrapedScore, '===');

    // Recalculate full match score
    await recalculateMatchScore(supabase, applicantId);

    return new Response(JSON.stringify({
      success: true,
      scrapedScore,
      profilesFound: analysis.profilesFound,
      summary: analysis.summary,
    }), { headers: corsHeaders });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

// Recalculate the full match score using updated scrape data
async function recalculateMatchScore(supabase: any, applicantId: string) {
  const { data: applicant } = await supabase.from('applicants').select('*').eq('id', applicantId).single();
  if (!applicant) return;
  const { data: property } = await supabase.from('landlord_properties').select('rent_amount').eq('id', applicant.property_id).single();
  if (!property) return;
  const { data: criteria } = await supabase.from('landlord_criteria').select('*').eq('property_id', applicant.property_id).maybeSingle();

  const rent = property.rent_amount || 1000;
  const scrapeData = {
    ...(applicant.scrape_linkedin ? { linkedin: applicant.scrape_linkedin } : {}),
    ...(applicant.scrape_kvk ? { kvk: applicant.scrape_kvk } : {}),
    ...(applicant.scrape_google ? { google: applicant.scrape_google } : {}),
  };

  // Inline scoring (same as telegram-screener's runMatchScoring)
  const answers = applicant.lifestyle_answers || {};
  const smoking = answers.smoking || null;
  const pets = answers.pets || null;
  const incomeRange = answers.income_range || null;
  const incomeEstimate = incomeRange ? getIncomeEstimate(incomeRange) : (applicant.monthly_income || 0);
  const flags: string[] = [];

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

  let fin = 0;
  const ratio = rent > 0 ? incomeEstimate / rent : 0;
  if (ratio >= 3) fin += 2.0; else if (ratio >= 2.5) fin += 1.0;
  const sd = Object.keys(scrapeData).length > 0 ? scrapeData : null;
  switch (applicant.employment_type) {
    case 'Loondienst (employed)': fin += 1.0; break;
    case 'ZZP (self-employed)': fin += ((sd as any)?.kvk?.yearsActive >= 2 ? 0.75 : 0.25); break;
    case 'Student': case 'Uitkering (benefits)': fin += 0.25; flags.push('Limited financial stability'); break;
    default: fin += 0.25;
  }
  fin += 0.5;
  fin = Math.max(0, Math.min(4, fin));

  let scr = sd ? 0 : 1.0;
  if (sd) {
    if ((sd as any).linkedin?.confirmsEmployer || (sd as any).linkedin?.confirmed) scr += 0.5;
    if ((sd as any).kvk?.confirmed) scr += 0.5;
    if ((sd as any).google?.noNegativeResults) scr += 0.5;
    else if ((sd as any).google?.negativeResults) { scr -= 0.5; flags.push('Negative mentions found'); }
  }
  scr = Math.max(0, Math.min(2, scr));

  const total = Math.round((pref + fin + scr) * 10) / 10;
  let label: string;
  if (total >= 8.5) label = 'Strong match'; else if (total >= 6.5) label = 'Good match';
  else if (total >= 4.5) label = 'Moderate match'; else label = 'Weak match';

  await supabase.from('applicants').update({
    match_score: Math.round(total * 10),
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
