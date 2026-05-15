import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// BAG Individual Access API v2 (Kadaster)
const BAG_BASE = 'https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { postcode, huisnummer, huisletter, toevoeging } = await req.json()

    if (!postcode || !huisnummer) {
      return new Response(
        JSON.stringify({ error: 'postcode and huisnummer are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const BAG_KEY = Deno.env.get('BAG_API_KEY')
    if (!BAG_KEY) {
      return new Response(
        JSON.stringify({ error: 'BAG API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bagHeaders = {
      'X-Api-Key': BAG_KEY,
      'Accept': 'application/hal+json',
      'Accept-Crs': 'epsg:28992',
    }

    // Remove spaces and uppercase the postcode (BAG expects 1234AB not 1234 AB)
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase()

    // Step 1: Look up the address
    let adresUrl = `${BAG_BASE}/adressen?postcode=${cleanPostcode}&huisnummer=${encodeURIComponent(huisnummer)}&exacteMatch=true`
    if (huisletter) adresUrl += `&huisletter=${encodeURIComponent(huisletter)}`
    if (toevoeging) adresUrl += `&huisnummertoevoeging=${encodeURIComponent(toevoeging)}`

    console.log('[bag-lookup] address URL:', adresUrl)
    const adresRes = await fetch(adresUrl, { headers: bagHeaders })

    if (!adresRes.ok) {
      const errText = await adresRes.text()
      console.error('[bag-lookup] address lookup failed:', adresRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'Address not found in BAG', details: errText }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adresData = await adresRes.json()
    const adressen = adresData._embedded?.adressen

    if (!adressen || adressen.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found in BAG' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adres = adressen[0]

    // Build the full street address
    let streetAddress = `${adres.openbareRuimteNaam} ${adres.huisnummer}`
    if (adres.huisletter) streetAddress += adres.huisletter
    if (adres.huisnummertoevoeging) streetAddress += `-${adres.huisnummertoevoeging}`

    const result: Record<string, unknown> = {
      address: streetAddress,
      postcode: adres.postcode,
      city: adres.woonplaatsNaam,
      bag_verified: true,
    }

    // Step 2: Get surface area from verblijfsobject
    // URL is in _links.adresseerbaarObject.href; data is nested under .verblijfsobject
    const vboHref = adres._links?.adresseerbaarObject?.href
    if (vboHref) {
      const vboRes = await fetch(vboHref, { headers: bagHeaders })
      if (vboRes.ok) {
        const vboData = await vboRes.json()
        const vbo = vboData.verblijfsobject
        if (vbo?.oppervlakte) result.surface_m2 = vbo.oppervlakte
        if (vbo?.gebruiksdoelen?.[0]) result.property_type = vbo.gebruiksdoelen[0]
      } else {
        console.warn('[bag-lookup] VBO lookup failed:', vboRes.status)
      }
    }

    // Step 3: Get construction year from pand
    // URL is in _links.panden[0].href; year is nested under .pand.oorspronkelijkBouwjaar
    const pandHref = adres._links?.panden?.[0]?.href
    if (pandHref) {
      const pandRes = await fetch(pandHref, { headers: bagHeaders })
      if (pandRes.ok) {
        const pandData = await pandRes.json()
        if (pandData.pand?.oorspronkelijkBouwjaar) result.building_year = parseInt(pandData.pand.oorspronkelijkBouwjaar)
      } else {
        console.warn('[bag-lookup] pand lookup failed:', pandRes.status)
      }
    }

    console.log('[bag-lookup] result:', JSON.stringify(result))
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[bag-lookup] error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
