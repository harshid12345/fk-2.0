// Parses an uploaded property document (PDF / DOCX / image / text) into plain
// text and appends the result to landlord_properties.knowledge_base_text so the
// Telegram bot can answer tenant questions using it.
//
// Strategy per file type:
//   - PDF      → unpdf (text-layer extraction, Deno-native). If too little text
//                comes back (scanned PDF / floor plan), we fall back to sending
//                the first page screenshots to Gemini vision via the Lovable AI
//                Gateway as a multi-image OCR pass.
//   - DOCX     → mammoth (raw text)
//   - Images   → Gemini vision (PNG/JPG/WebP)
//   - TXT/MD   → read as text
//
// Auth: forwards the caller's JWT so RLS still applies.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy, getResolvedPDFJS } from 'https://esm.sh/unpdf@0.12.1';
import mammoth from 'https://esm.sh/mammoth@1.8.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MAX_AI_CHARS = 60_000; // hard cap saved to DB per file

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

const EXTRACT_PROMPT = `You are extracting information from a property document for a tenant assistance AI.
Return clean plain text containing EVERYTHING that could matter to a tenant:
- House rules, appliance instructions, wifi credentials, codes
- Heating/thermostat operation, waste/recycling schedules
- Building access, keys, intercom, parking
- Maintenance contacts, emergency numbers
- Rental contract terms (rent, deposit, notice period, included utilities)
- Floor plan details: room names, dimensions, layout descriptions

Preserve numbers, names, addresses and codes verbatim. Do NOT summarise — extract everything.`;

async function callGeminiVision(images: { mime: string; b64: string }[], apiKey: string): Promise<string> {
  const content: any[] = [{ type: 'text', text: EXTRACT_PROMPT }];
  for (const img of images) {
    content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } });
  }
  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error('[parse-property-doc] AI gateway error', resp.status, t);
    if (resp.status === 429) throw new Error('AI rate limit — try again in a moment.');
    if (resp.status === 402) throw new Error('AI credits exhausted. Top up in Workspace > Usage.');
    throw new Error(`AI parsing failed (${resp.status})`);
  }
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

function uint8ToB64(buf: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function renderPdfPagesToPng(pdfBytes: Uint8Array, maxPages = 4): Promise<{ mime: string; b64: string }[]> {
  // unpdf bundles a Deno-friendly pdfjs build; we use it to render pages to canvas.
  // We render at 1.5x scale — enough for OCR without blowing past Gemini limits.
  const pdfjs = await getResolvedPDFJS();
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  const out: { mime: string; b64: string }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      // OffscreenCanvas is available in Deno Deploy
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d') as any;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      out.push({ mime: 'image/png', b64: uint8ToB64(buf) });
    } catch (err) {
      console.warn(`[parse-property-doc] failed to render PDF page ${i}`, err);
    }
  }
  return out;
}

async function extractFromPdf(pdfBytes: Uint8Array, apiKey: string): Promise<string> {
  // 1) try the text layer
  let textLayer = '';
  try {
    const pdf = await getDocumentProxy(pdfBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    textLayer = (text || '').trim();
  } catch (err) {
    console.warn('[parse-property-doc] unpdf extractText failed', err);
  }

  // If we got a meaningful amount of text, that's our answer.
  if (textLayer.length > 200) {
    return textLayer.slice(0, MAX_AI_CHARS);
  }

  // 2) fallback — render pages and OCR with Gemini vision
  console.log('[parse-property-doc] PDF has little/no text layer — falling back to vision OCR');
  try {
    const pages = await renderPdfPagesToPng(pdfBytes, 4);
    if (pages.length === 0) {
      return textLayer || '[PDF could not be rendered for OCR.]';
    }
    const visionText = await callGeminiVision(pages, apiKey);
    const combined = [textLayer, visionText].filter(Boolean).join('\n\n').trim();
    return combined.slice(0, MAX_AI_CHARS) || '[No readable text extracted from PDF.]';
  } catch (err) {
    console.error('[parse-property-doc] vision fallback failed', err);
    return textLayer || `[PDF parsing failed: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

async function extractFromDocx(bytes: Uint8Array): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    return (result.value || '').trim().slice(0, MAX_AI_CHARS) || '[DOCX contained no readable text.]';
  } catch (err) {
    console.error('[parse-property-doc] mammoth failed', err);
    throw new Error('DOCX parsing failed');
  }
}

async function extractFromImage(bytes: Uint8Array, mime: string, apiKey: string): Promise<string> {
  const b64 = uint8ToB64(bytes);
  const text = await callGeminiVision([{ mime, b64 }], apiKey);
  return text.slice(0, MAX_AI_CHARS) || '[No readable text extracted from image.]';
}

async function extractFromText(bytes: Uint8Array): Promise<string> {
  const text = new TextDecoder('utf-8').decode(bytes).trim();
  return text.slice(0, MAX_AI_CHARS);
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

    const { data: property, error: propErr } = await supabase
      .from('landlord_properties')
      .select('id, knowledge_base_urls, knowledge_base_text')
      .eq('id', propertyId)
      .maybeSingle();

    if (propErr || !property) {
      console.error('[parse-property-doc] property not accessible', propErr);
      return new Response(JSON.stringify({ error: 'Property not found or access denied' }), { status: 404, headers: corsHeaders });
    }

    const { data: blob, error: dlErr } = await supabase.storage.from('property-docs').download(storagePath);
    if (dlErr || !blob) {
      console.error('[parse-property-doc] download failed', dlErr);
      return new Response(JSON.stringify({ error: 'File download failed' }), { status: 500, headers: corsHeaders });
    }

    const fileName = storagePath.split('/').pop() || 'document';
    const mime = blob.type || mimeFromName(fileName);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    console.log(`[parse-property-doc] parsing ${fileName} (${mime}, ${bytes.length} bytes)`);

    let extracted = '';
    if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      extracted = await extractFromPdf(bytes, LOVABLE_API_KEY);
    } else if (mime.startsWith('image/')) {
      extracted = await extractFromImage(bytes, mime, LOVABLE_API_KEY);
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.toLowerCase().endsWith('.docx')
    ) {
      extracted = await extractFromDocx(bytes);
    } else if (mime.startsWith('text/') || /\.(txt|md)$/i.test(fileName)) {
      extracted = await extractFromText(bytes);
    } else {
      extracted = `[Document "${fileName}" was uploaded but its format (${mime}) is not supported. Supported: PDF, DOCX, PNG/JPG/WebP, TXT/MD.]`;
    }

    if (!extracted || !extracted.trim()) {
      extracted = `[Document "${fileName}" was uploaded but no readable text was extracted.]`;
    }

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

    console.log(`[parse-property-doc] success: ${fileName} → ${extracted.length} chars`);
    return new Response(JSON.stringify({ success: true, fileName, charsExtracted: extracted.length }), { headers: corsHeaders });
  } catch (err) {
    console.error('[parse-property-doc] error', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), { status: 500, headers: corsHeaders });
  }
});
