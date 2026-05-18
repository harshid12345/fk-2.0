import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Category {
  label: string
  dutchTerm: string
  englishTerm: string
  dutchAliases: string[]
  englishAliases: string[]
}

const CATEGORIES: Category[] = [
  {
    label: 'Plumber',
    dutchTerm: 'loodgieter',
    englishTerm: 'plumber',
    dutchAliases: ['loodgieter', 'loodgieters', 'lekkage', 'pijp', 'riool', 'waterleiding'],
    englishAliases: ['plumber', 'plumbers', 'plumbing', 'pipe', 'leak', 'drain'],
  },
  {
    label: 'Electrician',
    dutchTerm: 'elektricien',
    englishTerm: 'electrician',
    dutchAliases: ['elektricien', 'elektra', 'stroom', 'bedrading', 'elektriciteit', 'schakelaar'],
    englishAliases: ['electrician', 'electricians', 'electric', 'electrical', 'wiring', 'electricity'],
  },
  {
    label: 'Cleaner',
    dutchTerm: 'schoonmaakbedrijf',
    englishTerm: 'cleaning service',
    dutchAliases: ['schoonmaakbedrijf', 'schoonmaker', 'schoonmaak', 'reinigingsbedrijf', 'poets'],
    englishAliases: ['cleaner', 'cleaners', 'cleaning', 'housekeeping', 'maid'],
  },
  {
    label: 'Painter & Decorator',
    dutchTerm: 'schilder',
    englishTerm: 'painter',
    dutchAliases: ['schilder', 'schilders', 'schilderwerk', 'verf', 'behang', 'schildersbedrijf'],
    englishAliases: ['painter', 'painters', 'painting', 'decorator', 'decorating', 'wallpaper'],
  },
  {
    label: 'Handyman',
    dutchTerm: 'klusbedrijf',
    englishTerm: 'handyman',
    dutchAliases: ['klusbedrijf', 'klusjesman', 'klusser', 'klussen', 'klusdienst', 'alles'],
    englishAliases: ['handyman', 'handymen', 'odd jobs', 'fix it', 'general repairs'],
  },
  {
    label: 'Heating & Air Conditioning',
    dutchTerm: 'cv installateur',
    englishTerm: 'HVAC',
    dutchAliases: ['cv installateur', 'cv', 'verwarming', 'airco', 'warmtepomp', 'cv ketel', 'boiler', 'verwarmingsbedrijf'],
    englishAliases: ['hvac', 'heating', 'air conditioning', 'heat pump', 'boiler', 'furnace', 'ac', 'ac repair'],
  },
  {
    label: 'Locksmith',
    dutchTerm: 'slotenmaker',
    englishTerm: 'locksmith',
    dutchAliases: ['slotenmaker', 'slotenmakers', 'slot', 'sloten', 'sleutel', 'deurslot', 'inbraak'],
    englishAliases: ['locksmith', 'locksmiths', 'lock', 'locks', 'key', 'door lock', 'break in'],
  },
  {
    label: 'Roofer',
    dutchTerm: 'dakdekker',
    englishTerm: 'roofer',
    dutchAliases: ['dakdekker', 'dakdekkers', 'dakwerk', 'dak', 'dakraam', 'daklekkage', 'dakbedekking'],
    englishAliases: ['roofer', 'roofers', 'roofing', 'roof', 'roof repair', 'roof leak'],
  },
  {
    label: 'Carpenter',
    dutchTerm: 'timmerman',
    englishTerm: 'carpenter',
    dutchAliases: ['timmerman', 'timmerlui', 'timmerwerk', 'hout', 'timmerbedrijf', 'schrijnwerker'],
    englishAliases: ['carpenter', 'carpenters', 'carpentry', 'joiner', 'woodwork', 'cabinetmaker'],
  },
  {
    label: 'Tiler',
    dutchTerm: 'tegelzetter',
    englishTerm: 'tiler',
    dutchAliases: ['tegelzetter', 'tegelzetters', 'tegels', 'tegel', 'tegelwerk', 'vloertegels'],
    englishAliases: ['tiler', 'tilers', 'tiling', 'tile', 'tiles', 'floor tiles', 'bathroom tiles'],
  },
  {
    label: 'Pest Control',
    dutchTerm: 'ongediertebestrijding',
    englishTerm: 'pest control',
    dutchAliases: ['ongediertebestrijding', 'ongedierte', 'rattenbestrijding', 'kakkerlak', 'muis', 'muizen', 'vlooien'],
    englishAliases: ['pest control', 'pest', 'exterminator', 'rat', 'mice', 'cockroach', 'termite', 'bug'],
  },
  {
    label: 'Gardener',
    dutchTerm: 'hovenier',
    englishTerm: 'gardener',
    dutchAliases: ['hovenier', 'hoveniers', 'tuin', 'tuinman', 'tuinaanleg', 'grasmaaien', 'haag', 'tuinonderhoud'],
    englishAliases: ['gardener', 'gardeners', 'garden', 'lawn', 'landscaping', 'hedge', 'grass cutting'],
  },
  {
    label: 'Mover',
    dutchTerm: 'verhuisbedrijf',
    englishTerm: 'moving company',
    dutchAliases: ['verhuisbedrijf', 'verhuizer', 'verhuizers', 'verhuizing', 'verhuisdienst', 'transport'],
    englishAliases: ['mover', 'movers', 'moving', 'moving company', 'removal', 'removals', 'van hire'],
  },
]

const PROFANITY = ['fuck', 'shit', 'ass', 'dick', 'bitch', 'cunt', 'bastard', 'kut', 'klote', 'godverdomme', 'tering', 'kanker']

// Descriptive / niche phrases that don't match category names directly.
// Checked before category aliases so intent wins over keyword coincidences.
const INTENT_MAP: { categoryLabel: string; dutchTriggers: string[]; englishTriggers: string[] }[] = [
  {
    categoryLabel: 'Pest Control',
    dutchTriggers: ['ongedierte', 'wespen', 'muizen', 'ratten', 'kakkerlak', 'schimmel', 'vlooien', 'mieren'],
    englishTriggers: ['beehive', 'wasp nest', 'ant infestation', 'mice', 'rats', 'rodents', 'cockroach', 'bed bug', 'mold removal', 'mould removal', 'insect', 'spider', 'flea', 'termite'],
  },
  {
    categoryLabel: 'Plumber',
    dutchTriggers: ['waterlek', 'lekkage', 'verstopt', 'afvoer', 'kraan', 'rioolverstopping', 'waterleiding'],
    englishTriggers: ['leaking pipe', 'burst pipe', 'blocked drain', 'no hot water', 'toilet overflow', 'water leak', 'clogged drain'],
  },
  {
    categoryLabel: 'Electrician',
    dutchTriggers: ['stroomstoring', 'stopcontact', 'zekering', 'groep', 'meterkast'],
    englishTriggers: ['no power', 'power outage', 'broken outlet', 'fuse box', 'short circuit', 'tripped fuse', 'no electricity'],
  },
  {
    categoryLabel: 'Locksmith',
    dutchTriggers: ['buitengesloten', 'sleutel kwijt', 'slot kapot', 'nieuwe sleutel', 'deurslot'],
    englishTriggers: ['locked out', 'broken lock', 'key stuck', 'new keys', 'cant get in', "can't get in", 'lost key'],
  },
  {
    categoryLabel: 'Handyman',
    dutchTriggers: ['kapotte deur', 'vastgezet raam', 'krakende vloer', 'losse tegel', 'plank ophangen', 'deur klemt', 'raam klemt'],
    englishTriggers: ['broken door', 'stuck window', 'squeaky floor', 'loose tile', 'shelf installation', 'door wont close', "door won't close", 'cabinet repair'],
  },
  {
    categoryLabel: 'Heating & Air Conditioning',
    dutchTriggers: ['geen verwarming', 'cv ketel kapot', 'radiator koud', 'warmtepomp storing', 'cv storing'],
    englishTriggers: ['no heating', 'broken boiler', 'radiator cold', 'boiler broken', 'no hot water heating', 'heating not working'],
  },
  {
    categoryLabel: 'Cleaner',
    dutchTriggers: ['eindschoonmaak', 'opleverschoonmaak', 'diepte reiniging', 'huurder vertrokken'],
    englishTriggers: ['deep clean', 'end of tenancy', 'move out clean', 'deep cleaning', 'post tenancy', 'vacate clean'],
  },
]

function sanitizeQuery(raw: string): { googleQuery: string; label: string } | { error: string } {
  const input = raw.trim().toLowerCase()

  // Reject empty, purely numeric, or symbol-only input
  if (!input || /^[\d\s\W]+$/.test(input)) {
    return { error: 'Please search for a home service (e.g. Plumber, Electrician, Cleaner)' }
  }

  // Profanity / irrelevant check
  if (PROFANITY.some(w => input.includes(w))) {
    return { error: 'Please search for a home service (e.g. Plumber, Electrician, Cleaner)' }
  }

  // Intent map: descriptive phrases → correct category (checked before short-keyword aliases)
  for (const intent of INTENT_MAP) {
    const isDutch = intent.dutchTriggers.some(t => input.includes(t))
    const isEnglish = intent.englishTriggers.some(t => input.includes(t))
    if (isDutch || isEnglish) {
      const cat = CATEGORIES.find(c => c.label === intent.categoryLabel)!
      const googleQuery = isDutch && !isEnglish
        ? cat.dutchTerm
        : !isDutch && isEnglish
          ? cat.englishTerm
          : `${cat.dutchTerm} ${cat.englishTerm}`
      console.log(`[google-places-search] intent matched "${input}" -> "${cat.label}" (${isDutch && !isEnglish ? 'nl' : !isDutch ? 'en' : 'both'}) -> "${googleQuery}"`)
      return { googleQuery, label: cat.label }
    }
  }

  // Category alias match (direct keyword / category name)
  for (const cat of CATEGORIES) {
    const isDutch = cat.dutchAliases.some(a => input === a || input.includes(a))
    const isEnglish = cat.englishAliases.some(a => input === a || input.includes(a))
    const isLabel = input === cat.label.toLowerCase()

    if (isDutch || isEnglish || isLabel) {
      let googleQuery: string
      if (isDutch && !isEnglish) {
        googleQuery = cat.dutchTerm
      } else if (isEnglish && !isDutch) {
        googleQuery = cat.englishTerm
      } else {
        // label match or ambiguous — send both for maximum coverage
        googleQuery = `${cat.dutchTerm} ${cat.englishTerm}`
      }
      console.log(`[google-places-search] alias matched "${input}" -> "${cat.label}" (${isDutch ? 'nl' : isEnglish ? 'en' : 'both'}) -> "${googleQuery}"`)
      return { googleQuery, label: cat.label }
    }
  }

  return { error: 'Please search for a home service (e.g. Plumber, Electrician, Cleaner)' }
}

const VALID_RADII = new Set([1000, 2000, 5000, 10000, 20000])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, location, radiusMeters } = await req.json()

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

    const { googleQuery } = sanitized
    const radius = VALID_RADII.has(radiusMeters) ? radiusMeters : 5000
    console.log('[google-places-search] radius:', radius)

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
        textQuery: googleQuery,
        languageCode: 'nl',
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius,
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
