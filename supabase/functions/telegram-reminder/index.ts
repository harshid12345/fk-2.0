import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  preferred_language: string | null;
  telegram_chat_id: number | null;
  telegram_user_id: string | null;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const actions: string[] = [];

  try {
    await sendDueReminders(supabase, BOT_TOKEN, now, actions);
    await process24hNoResponses(supabase, BOT_TOKEN, now, actions);
    await processActiveCascades(supabase, BOT_TOKEN, now, actions);

    return new Response(JSON.stringify({ ok: true, actions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[reminder] Unhandled error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendDueReminders(supabase: any, token: string, now: Date, actions: string[]) {
  const upcomingCutoff = new Date(now.getTime() + 72 * HOUR_MS).toISOString();

  const { data: bookings, error: bookingsError } = await supabase
    .from('viewing_bookings')
    .select('id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cancelled_at, cascade_state, cascade_data, tenant_confirmed_3d')
    .eq('status', 'confirmed')
    .gt('slot_start', now.toISOString())
    .lte('slot_start', upcomingCutoff)
    .order('slot_start', { ascending: true });

  if (bookingsError) {
    throw new Error(`Failed to load bookings: ${bookingsError.message}`);
  }

  const bookingList = (bookings || []) as BookingRow[];
  if (bookingList.length === 0) {
    console.log('[reminder] No upcoming confirmed bookings');
    return;
  }

  const applicantIds = [...new Set(bookingList.map((b) => b.applicant_id).filter(Boolean))];
  const propertyIds = [...new Set(bookingList.map((b) => b.property_id).filter(Boolean))];

  const [{ data: applicants, error: applicantsError }, { data: properties, error: propertiesError }] = await Promise.all([
    applicantIds.length
      ? supabase
          .from('applicants')
          .select('id, property_id, full_name, preferred_language, telegram_chat_id, telegram_user_id, match_score, no_response_count, cancellation_count, match_flags, hard_disqualified, stage, viewing_booked_at')
          .in('id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
    propertyIds.length
      ? supabase.from('landlord_properties').select('id, address, landlord_id').in('id', propertyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (applicantsError) {
    throw new Error(`Failed to load applicants: ${applicantsError.message}`);
  }
  if (propertiesError) {
    throw new Error(`Failed to load properties: ${propertiesError.message}`);
  }

  const applicantMap = new Map<string, ApplicantRow>((applicants || []).map((a: ApplicantRow) => [a.id, a]));
  const propertyMap = new Map<string, PropertyRow>((properties || []).map((p: PropertyRow) => [p.id, p]));

  for (const booking of bookingList) {
    const applicant = applicantMap.get(booking.applicant_id);
    const property = propertyMap.get(booking.property_id);

    if (!applicant || !property) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: `A viewing reminder could not be sent because the booking is missing its applicant or property record.`,
        related_booking_id: booking.id,
      });
      actions.push(`booking ${booking.id} missing applicant/property record`);
      continue;
    }

    const chatId = resolveChatId(applicant);
    if (!chatId) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: `${applicant.full_name || 'An applicant'} has no Telegram chat linked, so the viewing reminder for ${property.address || 'the property'} could not be delivered.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });
      actions.push(`booking ${booking.id} has no Telegram chat id`);
      continue;
    }

    const reminderStage = getDueReminderStage(booking, now);
    if (!reminderStage) continue;

    const sendOk = await sendReminderMessage(supabase, token, booking, applicant, property, chatId, reminderStage);
    if (!sendOk) {
      await createNotificationOnce(supabase, {
        landlord_id: booking.landlord_id,
        type: 'reminder_delivery_failed',
        title: 'Reminder could not be sent',
        message: `Telegram failed while sending the ${reminderStage} reminder for ${applicant.full_name || 'an applicant'} at ${property.address || 'the property'}.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });
      actions.push(`${reminderStage} reminder failed for booking ${booking.id}`);
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (reminderStage === '48h') patch.tenant_confirmed_3d = true;
    if (reminderStage === '24h') patch.reminder_24h_sent_at = now.toISOString();
    if (reminderStage === '2h') patch.reminder_2h_sent_at = now.toISOString();

    const { error: updateError } = await supabase.from('viewing_bookings').update(patch).eq('id', booking.id);
    if (updateError) {
      console.error('[reminder] Failed to update booking after send:', booking.id, updateError.message);
    }

    await createLandlordReminderNotification(supabase, booking, applicant, property, reminderStage);
    console.log(`[reminder] ${reminderStage} reminder sent for booking ${booking.id}`);
    actions.push(`${reminderStage} reminder sent for booking ${booking.id}`);
  }
}

function getDueReminderStage(booking: BookingRow, now: Date): '48h' | '24h' | '2h' | null {
  const hoursUntil = (new Date(booking.slot_start).getTime() - now.getTime()) / HOUR_MS;
  if (hoursUntil <= 0) return null;

  if (hoursUntil <= 2 && !booking.reminder_2h_sent_at) {
    return '2h';
  }

  if (hoursUntil <= 24 && !booking.reminder_24h_sent_at) {
    return '24h';
  }

  if (hoursUntil <= 48 && hoursUntil > 24 && !booking.tenant_confirmed_3d) {
    return '48h';
  }

  return null;
}

async function sendReminderMessage(
  supabase: any,
  token: string,
  booking: BookingRow,
  applicant: ApplicantRow,
  property: PropertyRow,
  chatId: number,
  stage: '48h' | '24h' | '2h',
) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const start = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const address = property.address || 'the property';

  if (stage === '48h') {
    return await sendTg(
      token,
      chatId,
      `Hi ${firstName}, just a heads-up: your viewing for <b>${address}</b> is in 2 days — <b>${dateStr} at ${timeStr}</b>. I’ll remind you again closer to the time.`,
    );
  }

  if (stage === '24h') {
    return await sendTg(
      token,
      chatId,
      `Hi ${firstName}, reminder: your viewing for <b>${address}</b> is tomorrow at <b>${timeStr}</b>. Can you still make it?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'YES, I’ll be there', callback_data: 'remind_yes' }],
            [{ text: 'NO, cancel viewing', callback_data: 'remind_cancel' }],
          ],
        },
      },
    );
  }

  return await sendTg(
    token,
    chatId,
    `Quick reminder ${firstName}: your viewing for <b>${address}</b> is in about 2 hours — <b>${dateStr} at ${timeStr}</b>.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Still coming', callback_data: 'remind_yes' }],
          [{ text: 'Can’t make it', callback_data: 'remind_cancel' }],
        ],
      },
    },
  );
}

async function createLandlordReminderNotification(
  supabase: any,
  booking: BookingRow,
  applicant: ApplicantRow,
  property: PropertyRow,
  stage: '48h' | '24h' | '2h',
) {
  const start = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const label = stage === '48h' ? 'in 2 days' : stage === '24h' ? 'tomorrow' : 'in 2 hours';

  await createNotificationOnce(supabase, {
    landlord_id: booking.landlord_id,
    type: `viewing_reminder_${stage}`,
    title: `Viewing reminder ${label}`,
    message: `${applicant.full_name || 'An applicant'} has a viewing ${label} for ${property.address || 'the property'} on ${dateStr} at ${timeStr}.`,
    related_booking_id: booking.id,
    related_applicant_id: applicant.id,
  });
}

async function process24hNoResponses(supabase: any, token: string, now: Date, actions: string[]) {
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

  if (error) {
    throw new Error(`Failed to load 24h no-response bookings: ${error.message}`);
  }

  const bookingList = (bookings || []) as BookingRow[];
  if (bookingList.length === 0) return;

  const applicantIds = [...new Set(bookingList.map((b) => b.applicant_id).filter(Boolean))];
  const { data: applicants, error: applicantsError } = await supabase
    .from('applicants')
    .select('id, property_id, full_name, preferred_language, telegram_chat_id, telegram_user_id, match_score, no_response_count, cancellation_count, match_flags, hard_disqualified, stage, viewing_booked_at')
    .in('id', applicantIds);

  if (applicantsError) {
    throw new Error(`Failed to load applicants for no-response handling: ${applicantsError.message}`);
  }

  const applicantMap = new Map<string, ApplicantRow>((applicants || []).map((a: ApplicantRow) => [a.id, a]));

  for (const booking of bookingList) {
    const applicant = applicantMap.get(booking.applicant_id);
    if (!applicant) {
      actions.push(`24h no-response skipped for booking ${booking.id} (missing applicant)`);
      continue;
    }

    await applyCancellationPenalty(supabase, applicant.id, 'no_response');

    await supabase
      .from('viewing_bookings')
      .update({
        status: 'cancelled_tenant',
        cancelled_at: now.toISOString(),
        reminder_24h_response: 'no_response',
      })
      .eq('id', booking.id);

    await startCascade(supabase, token, booking, 10);
    console.log(`[reminder] 24h no-response cascade started for booking ${booking.id}`);
    actions.push(`24h no-response cascade started for booking ${booking.id}`);
  }
}

async function processActiveCascades(supabase: any, token: string, now: Date, actions: string[]) {
  const { data: activeCascades, error } = await supabase
    .from('viewing_bookings')
    .select('id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cancelled_at, cascade_state, cascade_data, tenant_confirmed_3d')
    .eq('cascade_state', 'active');

  if (error) {
    throw new Error(`Failed to load active cascades: ${error.message}`);
  }

  for (const booking of ((activeCascades || []) as BookingRow[])) {
    const cascadeData = booking.cascade_data || {};
    const cascadeStarted = new Date(cascadeData.started_at || 0);
    const timeoutMin = cascadeData.timeout_minutes || 10;
    const elapsedMin = (now.getTime() - cascadeStarted.getTime()) / MINUTE_MS;

    if (elapsedMin < timeoutMin) continue;

    await notifyLandlord(supabase, token, booking);

    for (const candidate of cascadeData.candidates || []) {
      if (candidate.response !== 'yes' && candidate.chat_id) {
        await sendTg(
          token,
          candidate.chat_id,
          'Thanks for considering. The viewing slot has been cancelled and the landlord will decide on next steps. We will keep you posted.',
        );
      }
    }

    await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', booking.id);
    console.log(`[reminder] Cascade timed out, landlord notified for booking ${booking.id}`);
    actions.push(`cascade timed out for booking ${booking.id}`);
  }
}

function resolveChatId(applicant: ApplicantRow | undefined) {
  if (!applicant) return null;
  if (typeof applicant.telegram_chat_id === 'number' && Number.isFinite(applicant.telegram_chat_id)) {
    return applicant.telegram_chat_id;
  }
  if (applicant.telegram_user_id) {
    const parsed = Number(applicant.telegram_user_id);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
    .from('notifications')
    .select('id')
    .eq('landlord_id', payload.landlord_id)
    .eq('type', payload.type)
    .eq('related_booking_id', payload.related_booking_id ?? null)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  await supabase.from('notifications').insert({
    landlord_id: payload.landlord_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    related_booking_id: payload.related_booking_id ?? null,
    related_applicant_id: payload.related_applicant_id ?? null,
  });
}

async function startCascade(supabase: any, token: string, booking: BookingRow, timeoutMinutes: number) {
  const { data: candidates } = await supabase
    .from('applicants')
    .select('id, telegram_chat_id, telegram_user_id, full_name, match_score')
    .eq('property_id', booking.property_id)
    .in('stage', ['approved', 'screening_complete'])
    .is('viewing_booked_at', null)
    .eq('hard_disqualified', false)
    .order('match_score', { ascending: false })
    .limit(3);

  if (!candidates || candidates.length === 0) {
    await notifyLandlord(supabase, token, booking);
    await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', booking.id);
    return;
  }

  const { data: property } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const address = property?.address || 'the property';
  const start = new Date(booking.slot_start);
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const cascadeCandidates: any[] = [];

  for (const candidate of candidates) {
    const chatId = resolveChatId(candidate);
    if (!chatId) continue;

    const firstName = (candidate.full_name || 'there').split(' ')[0];
    await sendTg(
      token,
      chatId,
      `Hi ${firstName}, a viewing slot just opened up at ${address} on ${dateStr} at ${timeStr}. Are you available? Reply YES to claim it or NO if not. First to confirm gets the slot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'YES, I want it', callback_data: `cascade_yes_${booking.id}` }],
            [{ text: 'NO, not available', callback_data: `cascade_no_${booking.id}` }],
          ],
        },
      },
    );

    cascadeCandidates.push({
      applicant_id: candidate.id,
      chat_id: chatId,
      full_name: candidate.full_name,
      response: null,
    });
  }

  await supabase
    .from('viewing_bookings')
    .update({
      cascade_state: 'active',
      cascade_data: {
        started_at: new Date().toISOString(),
        timeout_minutes: timeoutMinutes,
        candidates: cascadeCandidates,
        original_applicant_id: booking.applicant_id,
      },
    })
    .eq('id', booking.id);
}

async function notifyLandlord(supabase: any, _token: string, booking: BookingRow) {
  const { data: property } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const address = property?.address || 'the property';
  const start = new Date(booking.slot_start);
  const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  await createNotificationOnce(supabase, {
    landlord_id: booking.landlord_id,
    type: 'cancellation_no_replacement',
    title: 'Viewing cancelled — no replacement found',
    message: `Your viewing on ${dateStr} at ${timeStr} for ${address} has been cancelled and no replacement was found from your current applicant list.`,
    related_booking_id: booking.id,
  });
}

async function applyCancellationPenalty(supabase: any, applicantId: string, type: 'cancellation' | 'no_response') {
  const field = type === 'cancellation' ? 'cancellation_count' : 'no_response_count';

  const { data: applicant } = await supabase
    .from('applicants')
    .select('match_score, cancellation_count, no_response_count, match_flags')
    .eq('id', applicantId)
    .single();

  if (!applicant) return;

  const newCount = (applicant[field] || 0) + 1;
  const newScore = Math.max(0, (applicant.match_score || 0) - 5);
  const flags = applicant.match_flags || [];

  const totalIssues =
    (type === 'cancellation' ? newCount : applicant.cancellation_count || 0) +
    (type === 'no_response' ? newCount : applicant.no_response_count || 0);

  if (totalIssues >= 2 && !flags.includes('Reliability warning: multiple cancellations or no-shows')) {
    flags.push('Reliability warning: multiple cancellations or no-shows');
  }

  await supabase.from('applicants').update({
    [field]: newCount,
    match_score: newScore,
    match_flags: flags,
  }).eq('id', applicantId);
}

async function sendTg(token: string, chatId: number, text: string, extra?: any) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok || !result.ok) {
      console.error('[reminder] Telegram API error:', JSON.stringify(result));
      return false;
    }

    return true;
  } catch (error) {
    console.error('[reminder] Telegram send error:', error);
    return false;
  }
}
