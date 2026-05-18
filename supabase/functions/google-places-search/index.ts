import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowed categories with aliases for fuzzy matching
const CATEGORIES: { label: string; aliases: string[] }[] = [
  { label: 'Plumbers',      aliases: ['plumber', 'loodgieter', 'plumbing', 'pipe', 'leak', 'lekkage'] },
  { label: 'Electricians',  aliases: ['electrician', 'elektricien', 'electric', 'electrical', 'wiring', 'elektra', 'stroom'] },
  { label: 'Cleaners',      aliases: ['cleaner', 'schoonmaker', 'cleaning', 'schoonmaak', 'housekeeping'] },
  { label: 'Painters',      aliases: ['painter', 'schilder', 'painting', 'schilderwerk', 'verf'] },
  { label: 'Handymen',      aliases: ['handyman', 'klusjesman', 'handyman service', 'klussen', 'odd jobs', 'klusser'] },
  { label: 'HVAC/Heating',  aliases: ['hvac', 'heating', 'verwarming', 'cv', 'airco', 'air conditioning', 'boiler', 'warmtepomp', 'heat pump', 'cv ketel'] },
  { label: 'Locksmiths',    aliases: ['locksmith', 'slotenmaker', 'lock', 'slot', 'deur', 'sleutel'] },
  { label: 'Roofers',       aliases: ['roofer', 'dakdekker', 'roofing', 'dak', 'roof', 'dakwerk'] },
  { label: 'Carpenters',    aliases: ['carpenter', 'timmerman', 'carpentry', 'timmerwerk', 'wood', 'hout', 'joiner'] },
  { label: 'Tilers',        aliases: ['tiler', 'tegelzetter', 'tiling', 'tegels', 'tile', 'bathroom tiles'] },
  { label: 'Glaziers',      aliases: ['glazier', 'glaszetter', 'glass', 'glas', 'window', 'raam', 'ruit'] },
  { label: 'Pest Control',  aliases: ['pest control', 'ongediertebestrijding', 'pest', 'ongedierte', 'rat', 'muis', 'insect', 'bug', 'kakkerlak'] },
  { label: 'Gardeners',     aliases: ['gardener', 'hovenier', 'garden', 'tuin', 'lawn', 'gras', 'hedge', 'haag'] },
  { label: 'Movers',        aliases: ['mover', 'verhuizer', 'moving', 'verhuizing', 'transport', 'removal'] },
]

const PROFANITY = ['fuck', 'shit', 'ass', 'dick', 'bitch', 'cunt', 'bastard', 'kut', 'klote', 'godverdomme', 'tering', 'kanker']

function sanitizeQuery(raw: string): { category: string } | { error: string } {
  const input = raw.trim().toLowerCase()

  // Profanity / irrelevant check
  if (PROFANITY.some(w => input.includes(w))) {
    return { error: 'Please search for a home service category (e.g. Plumber, Electrician, Cleaner)' }
  }

  // Exact or alias match
  for (const cat of CATEGORIES) {
    if (
      input === cat.label.toLowerCase() ||
      cat.aliases.some(a => input === a || input.includes(a))
    ) {
      return { category: cat.label }
    }
  }

  // No match — reject
  return { error: 'Please search for a home service category (e.g. Plumber, Electrician, Cleaner)' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, location } = await req.json()

    if (!query || !location) {
      return new Response(
        JSON.stringify({ error: 'query and location are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and sanitize query against whitelist
    const sanitized = sanitizeQuery(query)
    if ('error' in sanitized) {
      return new Response(
        JSON.stringify({ error: sanitized.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const safeQuery = sanitized.category
    console.log('[google-places-search] sanitized query:', query, '->', safeQuery)

    const PLACES_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!PLACES_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Geocode the property address to lat/lng
    console.log('[google-places-search] geocoding:', location)
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${PLACES_KEY}`
    )
    const geoData = await geoRes.json()

    if (!geoData.results?.length) {
      console.warn('[google-places-search] geocode returned no results for:', location)
      return new Response(
        JSON.stringify({ specialists: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { lat, lng } = geoData.results[0].geometry.location
    console.log('[google-places-search] geocoded to:', lat, lng)

    // Step 2: Search for specialists near the property using Places API (New)
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.internationalPhoneNumber,places.primaryTypeDisplayName',
      },
      body: JSON.stringify({
        textQuery: safeQuery,
        languageCode: 'nl',
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 5000.0,
          },
        },
      }),
    })

    const placesData = await placesRes.json()
    console.log('[google-places-search] places API returned', placesData.places?.length ?? 0, 'results')

    const specialists = (placesData.places || []).map((p: any, idx: number) => ({
      id: idx + 1,
      name: p.displayName?.text ?? 'Onbekend',
      specialty: p.primaryTypeDisplayName?.text ?? '',
      rating: typeof p.rating === 'number' ? p.rating : 0,
      address: p.formattedAddress ?? '',
      phone: p.internationalPhoneNumber ?? '',
    }))

    return new Response(
      JSON.stringify({ specialists }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[google-places-search] error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
