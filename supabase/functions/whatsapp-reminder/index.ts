import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WA_API = 'https://graph.facebook.com/v19.0';
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  applicant_id: string;
  landlord_id: string;
  property_id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  reminder_24h_sent_at: string | null;
  reminder_24h_response: string | null;
  reminder_2h_sent_at: string | null;
  reminder_2h_response: string | null;
  cancelled_at: string | null;
  cascade_state: string | null;
  cascade_data: any;
  tenant_confirmed_3d: boolean | null;
};

type ApplicantRow = {
  id: string;
  property_id: string;
  full_name: string | null;
  whatsapp_phone: string | null;
  match_score?: number | null;
  no_response_count?: number | null;
  cancellation_count?: number | null;
  match_flags?: any;
  hard_disqualified?: boolean | null;
  stage?: string | null;
  viewing_booked_at?: string | null;
};

type PropertyRow = {
  id: string;
  address: string | null;
  landlord_id: string;
};

// ─── WhatsApp helpers ─────────────────────────────────────────────────────────

async function sendText(phoneNumberId: string, token: string, to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: body.substring(0, 4096) },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[wa-reminder] WA API error:', JSON.stringify(data));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[wa-reminder] WA send error:', err);
    return false;
  }
}

async function sendButtons(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
): Promise<boolean> {
  try {
    const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText.substring(0, 1024) },
          action: {
            buttons: buttons.slice(0, 3).map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.substring(0, 20) },
            })),
          },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[wa-reminder] WA buttons error:', JSON.stringify(data));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[wa-reminder] WA buttons send error:', err);
    return false;
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[wa-reminder] Missing required environment variables');
    return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const actions: string[] = [];

  try {
    await sendDueReminders(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, now, actions);
    await process24hNoResponses(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, now, actions);
    await processActiveCascades(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, now, actions);

    return new Response(JSON.stringify({ ok: true, actions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[wa-reminder] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── 1. Send due reminders (48h / 24h / 2h) ──────────────────────────────────

async function sendDueReminders(
  supabase: any,
  phoneNumberId: string,
  token: string,
  now: Date,
  actions: string[],
) {
  const upcomingCutoff = new Date(now.getTime() + 72 * HOUR_MS).toISOString();

  const { data: bookings, error: bookingsError } = await supabase
    .from('viewing_bookings')
    .select('id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cancelled_at, cascade_state, cascade_data, tenant_confirmed_3d')
    .eq('status', 'confirmed')
    .gt('slot_start', now.toISOString())
    .lte('slot_start', upcomingCutoff)
    .order('slot_start', { ascending: true });

  if (bookingsError) throw new Error(`Failed to load bookings: ${bookingsError.message}`);

  const bookingList = (bookings || []) as BookingRow[];
  if (bookingList.length === 0) {
    console.log('[wa-reminder] No upcoming confirmed bookings');
    return;
  }

  const applicantIds = [...new Set(bookingList.map(b => b.applicant_id).filter(Boolean))];
  const propertyIds  = [...new Set(bookingList.map(b => b.property_id).filter(Boolean))];

  const [{ data: applicants, error: appErr }, { data: properties, error: propErr }] = await Promise.all([
    applicantIds.length
      ? supabase.from('applicants')
          .select('id, property_id, full_name, whatsapp_phone, match_score, no_response_count, cancellation_count, match_flags, hard_disqualified, stage, viewing_booked_at')
          .in('id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? supabase.from('landlord_properties').select('id, address, landlord_id').in('id', propertyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (appErr)  throw new Error(`Failed to load applicants: ${appErr.message}`);
  if (propErr) throw new Error(`Failed to load properties: ${propErr.message}`);

  const applicantMap = new Map<string, ApplicantRow>((applicants || []).map((a: ApplicantRow) => [a.id, a]));
  const propertyMap  = new Map<string, PropertyRow>((properties || []).map((p: PropertyRow) => [p.id, p]));

  for (const booking of bookingList) {
    const applicant = applicantMap.get(booking.applicant_id);
    const property  = propertyMap.get(booking.property_id);

    if (!applicant || !property) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: 'A viewing reminder could not be sent because the booking is missing its applicant or property record.',
        related_booking_id: booking.id,
      });
      actions.push(`booking ${booking.id} missing applicant/property record`);
      continue;
    }

    const waPhone = applicant.whatsapp_phone;
    if (!waPhone) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: `${applicant.full_name || 'An applicant'} has no WhatsApp number linked, so the viewing reminder for ${property.address || 'the property'} could not be delivered.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });
      actions.push(`booking ${booking.id} has no whatsapp_phone`);
      continue;
    }

    const stage = getDueReminderStage(booking, now);
    if (!stage) continue;

    const sent = await sendReminderMessage(supabase, phoneNumberId, token, booking, applicant, property, waPhone, stage);

    if (!sent) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: `WhatsApp failed while sending the ${stage} reminder for ${applicant.full_name || 'an applicant'} at ${property.address || 'the property'}.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });
      actions.push(`${stage} reminder failed for booking ${booking.id}`);
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (stage === '48h') patch.tenant_confirmed_3d = true;
    if (stage === '24h') patch.reminder_24h_sent_at = now.toISOString();
    if (stage === '2h')  patch.reminder_2h_sent_at  = now.toISOString();

    const { error: updateErr } = await supabase.from('viewing_bookings').update(patch).eq('id', booking.id);
    if (updateErr) console.error('[wa-reminder] Failed to update booking after send:', booking.id, updateErr.message);

    await createLandlordReminderNotification(supabase, booking, applicant, property, stage);
    console.log(`[wa-reminder] ${stage} reminder sent for booking ${booking.id}`);
    actions.push(`${stage} reminder sent for booking ${booking.id}`);
  }
}

// ─── 2. Which reminder stage is due? ─────────────────────────────────────────

function getDueReminderStage(booking: BookingRow, now: Date): '48h' | '24h' | '2h' | null {
  const hoursUntil = (new Date(booking.slot_start).getTime() - now.getTime()) / HOUR_MS;
  if (hoursUntil <= 0) return null;
  if (hoursUntil <= 2  && !booking.reminder_2h_sent_at)                          return '2h';
  if (hoursUntil <= 24 && !booking.reminder_24h_sent_at)                         return '24h';
  if (hoursUntil <= 48 && hoursUntil > 24 && !booking.tenant_confirmed_3d)       return '48h';
  return null;
}

// ─── 3. Build and send the reminder message ───────────────────────────────────

async function sendReminderMessage(
  _supabase: any,
  phoneNumberId: string,
  token: string,
  booking: BookingRow,
  applicant: ApplicantRow,
  property: PropertyRow,
  waPhone: string,
  stage: '48h' | '24h' | '2h',
): Promise<boolean> {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const start   = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const address = property.address || 'the property';

  if (stage === '48h') {
    return sendText(phoneNumberId, token, waPhone,
      `Hi ${firstName}, just a heads-up: your viewing for ${address} is in 2 days — ${dateStr} at ${timeStr}. I'll remind you again closer to the time.`
    );
  }

  if (stage === '24h') {
    return sendButtons(phoneNumberId, token, waPhone,
      `Hi ${firstName}, reminder: your viewing for ${address} is tomorrow at ${timeStr}. Can you still make it?`,
      [
        { id: 'remind_yes',    title: "Yes, I'll be there" },
        { id: 'remind_cancel', title: 'No, cancel viewing' },
      ]
    );
  }

  // 2h
  return sendButtons(phoneNumberId, token, waPhone,
    `Quick reminder ${firstName}: your viewing for ${address} is in about 2 hours — ${dateStr} at ${timeStr}.`,
    [
      { id: 'remind_yes',    title: 'Still coming' },
      { id: 'remind_cancel', title: "Can't make it" },
    ]
  );
}

// ─── 4. Landlord in-app notification for each reminder sent ──────────────────

async function createLandlordReminderNotification(
  supabase: any,
  booking: BookingRow,
  applicant: ApplicantRow,
  property: PropertyRow,
  stage: '48h' | '24h' | '2h',
) {
  const start   = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const label   = stage === '48h' ? 'in 2 days' : stage === '24h' ? 'tomorrow' : 'in 2 hours';

  await createNotificationOnce(supabase, {
    landlord_id: booking.landlord_id,
    type: `viewing_reminder_${stage}`,
    title: `Viewing reminder ${label}`,
    message: `${applicant.full_name || 'An applicant'} has a viewing ${label} for ${property.address || 'the property'} on ${dateStr} at ${timeStr}.`,
    related_booking_id: booking.id,
    related_applicant_id: applicant.id,
  });
}

// ─── 5. Process 24h no-responses → cancel + cascade ─────────────────────────

async function process24hNoResponses(
  supabase: any,
  phoneNumberId: string,
  token: string,
  now: Date,
  actions: string[],
) {
  // Grace period: wait 10 minutes after the 24h reminder was sent before escalating
  const cutoff = new Date(now.getTime() - 10 * MINUTE_MS).toISOString();

  const { data: bookings, error } = await supabase
    .from('viewing_bookings')
    .select('id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cancelled_at, cascade_state, cascade_data, tenant_confirmed_3d')
    .eq('status', 'confirmed')
    .not('reminder_24h_sent_at', 'is', null)
    .is('reminder_24h_response', null)
    .is('cascade_state', null)
    .lte('reminder_24h_sent_at', cutoff)
    .gt('slot_start', now.toISOString())
    .order('slot_start', { ascending: true });

  if (error) throw new Error(`Failed to load 24h no-response bookings: ${error.message}`);

  const bookingList = (bookings || []) as BookingRow[];
  if (bookingList.length === 0) return;

  const applicantIds = [...new Set(bookingList.map(b => b.applicant_id).filter(Boolean))];
  const { data: applicants, error: appErr } = await supabase
    .from('applicants')
    .select('id, property_id, full_name, whatsapp_phone, match_score, no_response_count, cancellation_count, match_flags, hard_disqualified, stage, viewing_booked_at')
    .in('id', applicantIds);

  if (appErr) throw new Error(`Failed to load applicants for no-response handling: ${appErr.message}`);

  const applicantMap = new Map<string, ApplicantRow>((applicants || []).map((a: ApplicantRow) => [a.id, a]));

  for (const booking of bookingList) {
    const applicant = applicantMap.get(booking.applicant_id);
    if (!applicant) {
      actions.push(`24h no-response skipped for booking ${booking.id} (missing applicant)`);
      continue;
    }

    await applyCancellationPenalty(supabase, applicant.id, 'no_response');

    await supabase.from('viewing_bookings').update({
      status: 'cancelled_tenant',
      cancelled_at: now.toISOString(),
      reminder_24h_response: 'no_response',
    }).eq('id', booking.id);

    await startCascade(supabase, phoneNumberId, token, booking, 10);
    console.log(`[wa-reminder] 24h no-response cascade started for booking ${booking.id}`);
    actions.push(`24h no-response cascade started for booking ${booking.id}`);
  }
}

// ─── 6. Process active cascades that have timed out ──────────────────────────

async function processActiveCascades(
  supabase: any,
  phoneNumberId: string,
  token: string,
  now: Date,
  actions: string[],
) {
  const { data: activeCascades, error } = await supabase
    .from('viewing_bookings')
    .select('id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cancelled_at, cascade_state, cascade_data, tenant_confirmed_3d')
    .eq('cascade_state', 'active');

  if (error) throw new Error(`Failed to load active cascades: ${error.message}`);

  for (const booking of ((activeCascades || []) as BookingRow[])) {
    const cascadeData    = booking.cascade_data || {};
    const cascadeStarted = new Date(cascadeData.started_at || 0);
    const timeoutMin     = cascadeData.timeout_minutes || 10;
    const elapsedMin     = (now.getTime() - cascadeStarted.getTime()) / MINUTE_MS;

    if (elapsedMin < timeoutMin) continue;

    await notifyLandlord(supabase, booking);

    // Message candidates who never responded
    for (const candidate of (cascadeData.candidates || [])) {
      if (candidate.response !== 'yes' && candidate.wa_to) {
        await sendText(phoneNumberId, token, candidate.wa_to,
          'Thanks for considering. The viewing slot has been cancelled and the landlord will decide on next steps. We will keep you posted.'
        );
      }
    }

    await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', booking.id);
    console.log(`[wa-reminder] Cascade timed out, landlord notified for booking ${booking.id}`);
    actions.push(`cascade timed out for booking ${booking.id}`);
  }
}

// ─── 7. Start a new cascade after a no-show / cancellation ──────────────────

async function startCascade(
  supabase: any,
  phoneNumberId: string,
  token: string,
  booking: BookingRow,
  timeoutMinutes: number,
) {
  const { data: candidates } = await supabase
    .from('applicants')
    .select('id, whatsapp_phone, full_name, match_score')
    .eq('property_id', booking.property_id)
    .in('stage', ['approved', 'screening_complete'])
    .is('viewing_booked_at', null)
    .eq('hard_disqualified', false)
    .neq('id', booking.applicant_id)
    .order('match_score', { ascending: false })
    .limit(3);

  if (!candidates || candidates.length === 0) {
    await notifyLandlord(supabase, booking);
    await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', booking.id);
    return;
  }

  const { data: property } = await supabase
    .from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const address = property?.address || 'the property';
  const start   = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const cascadeCandidates: any[] = [];

  for (const candidate of candidates) {
    const waTo = candidate.whatsapp_phone;
    if (!waTo) continue;

    const firstName = (candidate.full_name || 'there').split(' ')[0];
    await sendButtons(phoneNumberId, token, waTo,
      `Hi ${firstName}, a viewing slot just opened up at ${address} on ${dateStr} at ${timeStr}. Are you available? First to confirm gets the slot.`,
      [
        { id: `cascade_yes_${booking.id}`, title: 'YES, I want it' },
        { id: `cascade_no_${booking.id}`,  title: 'No, not available' },
      ]
    );

    cascadeCandidates.push({
      applicant_id: candidate.id,
      wa_to: waTo,
      full_name: candidate.full_name,
      response: null,
    });
  }

  await supabase.from('viewing_bookings').update({
    cascade_state: 'active',
    cascade_data: {
      started_at: new Date().toISOString(),
      timeout_minutes: timeoutMinutes,
      candidates: cascadeCandidates,
      original_applicant_id: booking.applicant_id,
    },
  }).eq('id', booking.id);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function notifyLandlord(supabase: any, booking: BookingRow) {
  const { data: property } = await supabase
    .from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const address = property?.address || 'the property';
  const start   = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  await createNotificationOnce(supabase, {
    landlord_id: booking.landlord_id,
    type: 'cancellation_no_replacement',
    title: 'Viewing cancelled — no replacement found',
    message: `Your viewing on ${dateStr} at ${timeStr} for ${address} was cancelled and no replacement was found from your current applicant list.`,
    related_booking_id: booking.id,
  });
}

async function applyCancellationPenalty(
  supabase: any,
  applicantId: string,
  type: 'cancellation' | 'no_response',
) {
  const field = type === 'cancellation' ? 'cancellation_count' : 'no_response_count';
  const { data: applicant } = await supabase
    .from('applicants')
    .select('match_score, cancellation_count, no_response_count, match_flags')
    .eq('id', applicantId).single();
  if (!applicant) return;

  const newCount = (applicant[field] || 0) + 1;
  const newScore = Math.max(0, (applicant.match_score || 0) - 5);
  const flags    = applicant.match_flags || [];
  const total    =
    (type === 'cancellation' ? newCount : applicant.cancellation_count || 0) +
    (type === 'no_response'  ? newCount : applicant.no_response_count  || 0);

  if (total >= 2 && !flags.includes('Reliability warning: multiple cancellations or no-shows')) {
    flags.push('Reliability warning: multiple cancellations or no-shows');
  }

  await supabase.from('applicants').update({
    [field]: newCount,
    match_score: newScore,
    match_flags: flags,
  }).eq('id', applicantId);
}

async function createNotificationOnce(
  supabase: any,
  payload: {
    landlord_id: string;
    type: string;
    title: string;
    message: string;
    related_booking_id?: string | null;
    related_applicant_id?: string | null;
  },
) {
  const { data: existing } = await supabase
    .from('notifications').select('id')
    .eq('landlord_id', payload.landlord_id)
    .eq('type', payload.type)
    .eq('related_booking_id', payload.related_booking_id ?? null)
    .limit(1).maybeSingle();

  if (existing) return;

  await supabase.from('notifications').insert({
    landlord_id: payload.landlord_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    related_booking_id:  payload.related_booking_id  ?? null,
    related_applicant_id: payload.related_applicant_id ?? null,
  });
}
