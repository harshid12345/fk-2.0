import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        textQuery: query,
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
