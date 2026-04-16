// Parses an uploaded property document (PDF / DOCX / image) into plain text
// using Lovable AI Gateway (Gemini multimodal), then appends the result to
// landlord_properties.knowledge_base_text for the given property.
//
// Auth: forwards the caller's JWT to Supabase so RLS still applies (only the
// landlord who owns the property — and thus the storage object — can trigger
// parsing for it).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'txt' || ext === 'md') return 'text/plain';
  return 'application/octet-stream';
}

async function parseWithAI(fileB64: string, mime: string, fileName: string, apiKey: string): Promise<string> {
  // Gemini supports PDFs and images directly via image_url with data URIs
  const supportsInline = mime === 'application/pdf' || mime.startsWith('image/');

  if (!supportsInline) {
    // For DOCX/DOC/etc we can't pass natively — return a placeholder note
    return `[Document "${fileName}" was uploaded but its format (${mime}) could not be auto-parsed. The landlord should re-upload as PDF for AI to read it.]`;
  }

  const dataUrl = `data:${mime};base64,${fileB64}`;
  const prompt = `Extract ALL useful information from this property document for a tenant assistance AI. Include:
- House rules, appliance instructions, wifi credentials
- Heating/thermostat operation, waste/recycling schedules
- Building access, keys, intercom info
- Maintenance contacts, emergency numbers
- Any rental contract terms (rent, deposit, notice period, included utilities)

Return clean plain text. Preserve numbers, names and codes verbatim. Do NOT summarise — extract everything that could matter to a tenant.`;

  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error('[parse-property-doc] AI gateway error', resp.status, t);
    if (resp.status === 429) throw new Error('AI rate limit — try again in a moment.');
    if (resp.status === 402) throw new Error('AI credits exhausted. Top up in Workspace > Usage.');
    throw new Error('AI parsing failed');
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return text || `[Document "${fileName}" was uploaded but no readable text was extracted.]`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { propertyId, storagePath } = await req.json();
    if (!propertyId || !storagePath) {
      return new Response(JSON.stringify({ error: 'propertyId and storagePath required' }), { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch property — RLS ensures only the owning landlord can read it
    const { data: property, error: propErr } = await supabase
      .from('landlord_properties')
      .select('id, knowledge_base_urls, knowledge_base_text')
      .eq('id', propertyId)
      .maybeSingle();

    if (propErr || !property) {
      console.error('[parse-property-doc] property not accessible', propErr);
      return new Response(JSON.stringify({ error: 'Property not found or access denied' }), { status: 404, headers: corsHeaders });
    }

    // Download the file from storage (RLS ensures the caller owns the folder)
    const { data: blob, error: dlErr } = await supabase.storage.from('property-docs').download(storagePath);
    if (dlErr || !blob) {
      console.error('[parse-property-doc] download failed', dlErr);
      return new Response(JSON.stringify({ error: 'File download failed' }), { status: 500, headers: corsHeaders });
    }

    const fileName = storagePath.split('/').pop() || 'document';
    const mime = blob.type || mimeFromName(fileName);

    // Convert to base64
    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);

    console.log(`[parse-property-doc] parsing ${fileName} (${mime}, ${buf.length} bytes)`);
    const extracted = await parseWithAI(b64, mime, fileName, LOVABLE_API_KEY);

    // Append to knowledge_base_text with a clear file delimiter so we can later
    // remove a single document's content if/when the landlord deletes it.
    const newSection = `\n\n===== FILE: ${fileName} =====\n${extracted}\n===== END FILE: ${fileName} =====\n`;
    const newKbText = (property.knowledge_base_text || '') + newSection;

    const newUrls = Array.isArray(property.knowledge_base_urls)
      ? Array.from(new Set([...property.knowledge_base_urls, storagePath]))
      : [storagePath];

    const { error: updErr } = await supabase
      .from('landlord_properties')
      .update({ knowledge_base_urls: newUrls, knowledge_base_text: newKbText })
      .eq('id', propertyId);

    if (updErr) {
      console.error('[parse-property-doc] update failed', updErr);
      return new Response(JSON.stringify({ error: 'Failed to save parsed text' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, fileName, charsExtracted: extracted.length }), { headers: corsHeaders });
  } catch (err) {
    console.error('[parse-property-doc] error', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), { status: 500, headers: corsHeaders });
  }
});
