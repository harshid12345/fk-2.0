import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  if (!BOT_TOKEN) return new Response(JSON.stringify({ error: 'No bot token' }), { status: 500, headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = new Date();
  const results: string[] = [];

  try {
    // ═══════════════════════════════════════════
    // 1. SEND 24H REMINDERS
    // ═══════════════════════════════════════════
    const h24from = new Date(now.getTime() + 23 * 3600_000);
    const h24to = new Date(now.getTime() + 25 * 3600_000);

    const { data: need24h } = await supabase.from('viewing_bookings')
      .select('*, applicants!inner(id, telegram_chat_id, telegram_user_id, full_name, preferred_language, property_id)')
      .eq('status', 'confirmed')
      .is('reminder_24h_sent_at', null)
      .gte('slot_start', h24from.toISOString())
      .lte('slot_start', h24to.toISOString());

    for (const b of (need24h || [])) {
      const chatId = b.applicants?.telegram_chat_id || (b.applicants?.telegram_user_id ? parseInt(b.applicants.telegram_user_id) : null);
      if (!chatId) continue;
      const firstName = (b.applicants?.full_name || 'there').split(' ')[0];
      const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', b.property_id).single();
      const addr = prop?.address || 'the property';
      const dt = new Date(b.slot_start);
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      await sendTg(BOT_TOKEN, chatId,
        `Hi ${firstName}, just a reminder that you have a viewing tomorrow at ${timeStr} for ${addr}. Are you still coming? Reply YES to confirm or NO to cancel.`
      );
      await supabase.from('viewing_bookings').update({
        reminder_24h_sent_at: now.toISOString(),
        tenant_confirmed_1d: true,
      }).eq('id', b.id);
      results.push(`24h reminder sent for booking ${b.id}`);
    }

    // ═══════════════════════════════════════════
    // 2. CHECK 24H NO-RESPONSE (10 min timeout)
    // ═══════════════════════════════════════════
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000);

    const { data: noResponse24 } = await supabase.from('viewing_bookings')
      .select('*, applicants!inner(id, telegram_chat_id, telegram_user_id, full_name, property_id, match_score, no_response_count)')
      .eq('status', 'confirmed')
      .not('reminder_24h_sent_at', 'is', null)
      .is('reminder_24h_response', null)
      .is('cascade_state', null)
      .lte('reminder_24h_sent_at', tenMinAgo.toISOString());

    for (const b of (noResponse24 || [])) {
      // No response = treat as cancellation
      await applyCancellationPenalty(supabase, b.applicants.id, 'no_response');

      // Cancel the booking
      await supabase.from('viewing_bookings').update({
        status: 'cancelled_tenant',
        cancelled_at: now.toISOString(),
        reminder_24h_response: 'no_response',
      }).eq('id', b.id);

      // Start cascade
      await startCascade(supabase, BOT_TOKEN, b, 10);
      results.push(`24h no-response cascade started for booking ${b.id}`);
    }

    // ═══════════════════════════════════════════
    // 3. CHECK CASCADE TIMEOUTS (10 min for 24h, 5 min for 2h)
    // ═══════════════════════════════════════════
    const { data: activeCascades } = await supabase.from('viewing_bookings')
      .select('*')
      .eq('cascade_state', 'active');

    for (const b of (activeCascades || [])) {
      const cascadeData = b.cascade_data || {};
      const cascadeStarted = new Date(cascadeData.started_at || 0);
      const timeoutMin = cascadeData.timeout_minutes || 10;
      const elapsed = (now.getTime() - cascadeStarted.getTime()) / 60_000;

      if (elapsed >= timeoutMin) {
        // No one claimed it — notify landlord
        await notifyLandlord(supabase, BOT_TOKEN, b);

        // Notify cascade candidates that slot is gone
        for (const c of (cascadeData.candidates || [])) {
          if (c.response !== 'yes') {
            const cChatId = c.chat_id;
            if (cChatId) {
              await sendTg(BOT_TOKEN, cChatId,
                `Thanks for considering. The viewing slot has been cancelled and the landlord will decide on next steps. We will keep you posted.`
              );
            }
          }
        }

        await supabase.from('viewing_bookings').update({
          cascade_state: 'landlord_notified',
        }).eq('id', b.id);
        results.push(`Cascade timed out, landlord notified for booking ${b.id}`);
      }
    }

    // ═══════════════════════════════════════════
    // 4. SEND 2H REMINDERS
    // ═══════════════════════════════════════════
    const h2from = new Date(now.getTime() + 1.5 * 3600_000);
    const h2to = new Date(now.getTime() + 2.5 * 3600_000);

    const { data: need2h } = await supabase.from('viewing_bookings')
      .select('*, applicants!inner(id, telegram_chat_id, telegram_user_id, full_name, property_id)')
      .eq('status', 'confirmed')
      .is('reminder_2h_sent_at', null)
      .gte('slot_start', h2from.toISOString())
      .lte('slot_start', h2to.toISOString());

    for (const b of (need2h || [])) {
      const chatId = b.applicants?.telegram_chat_id || (b.applicants?.telegram_user_id ? parseInt(b.applicants.telegram_user_id) : null);
      if (!chatId) continue;
      const firstName = (b.applicants?.full_name || 'there').split(' ')[0];
      const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', b.property_id).single();
      const addr = prop?.address || 'the property';
      const dt = new Date(b.slot_start);
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      await sendTg(BOT_TOKEN, chatId,
        `Quick reminder, your viewing at ${addr} is in 2 hours at ${timeStr}. See you there!`
      );
      await supabase.from('viewing_bookings').update({
        reminder_2h_sent_at: now.toISOString(),
      }).eq('id', b.id);
      results.push(`2h reminder sent for booking ${b.id}`);
    }

    // ═══════════════════════════════════════════
    // 5. CHECK 2H NO-RESPONSE (handled via callback in screener)
    // ═══════════════════════════════════════════
    // 2h reminders are passive ("see you there"), cancellation at this stage
    // is handled through the chatbot YES/NO flow with 5 min cascade timeout

    return new Response(JSON.stringify({ ok: true, actions: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[reminder] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══════════════════════════════════════════
// CASCADE: offer slot to top 3 applicants
// ═══════════════════════════════════════════
async function startCascade(supabase: any, token: string, booking: any, timeoutMinutes: number) {
  const { data: candidates } = await supabase.from('applicants')
    .select('id, telegram_chat_id, telegram_user_id, full_name, match_score')
    .eq('property_id', booking.property_id)
    .in('stage', ['approved', 'screening_complete'])
    .is('viewing_booked_at', null)
    .eq('hard_disqualified', false)
    .order('match_score', { ascending: false })
    .limit(3);

  if (!candidates || candidates.length === 0) {
    // No candidates available — go straight to landlord
    await notifyLandlord(supabase, token, booking);
    await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', booking.id);
    return;
  }

  const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const addr = prop?.address || 'the property';
  const dt = new Date(booking.slot_start);
  const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const cascadeCandidates: any[] = [];

  for (const c of candidates) {
    const chatId = c.telegram_chat_id || (c.telegram_user_id ? parseInt(c.telegram_user_id) : null);
    if (!chatId) continue;

    const firstName = (c.full_name || 'there').split(' ')[0];
    await sendTg(token, chatId,
      `Hi ${firstName}, a viewing slot just opened up at ${addr} on ${dateStr} at ${timeStr}. Are you available? Reply YES to claim it or NO if not. First to confirm gets the slot.`,
      {
        reply_markup: { inline_keyboard: [
          [{ text: 'YES, I want it', callback_data: `cascade_yes_${booking.id}` }],
          [{ text: 'NO, not available', callback_data: `cascade_no_${booking.id}` }],
        ] }
      }
    );

    cascadeCandidates.push({
      applicant_id: c.id,
      chat_id: chatId,
      full_name: c.full_name,
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

// ═══════════════════════════════════════════
// NOTIFY LANDLORD
// ═══════════════════════════════════════════
async function notifyLandlord(supabase: any, token: string, booking: any) {
  const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
  const addr = prop?.address || 'the property';
  const dt = new Date(booking.slot_start);
  const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  // Create notification for landlord in-app
  await supabase.from('notifications').insert({
    landlord_id: booking.landlord_id,
    type: 'cancellation_no_replacement',
    title: `Viewing cancelled — no replacement found`,
    message: `Your viewing on ${dateStr} at ${timeStr} for ${addr} has been cancelled and no replacement was found from your current applicant list.`,
    related_booking_id: booking.id,
  });
}

// ═══════════════════════════════════════════
// SCORE PENALTY
// ═══════════════════════════════════════════
async function applyCancellationPenalty(supabase: any, applicantId: string, type: 'cancellation' | 'no_response') {
  const field = type === 'cancellation' ? 'cancellation_count' : 'no_response_count';

  const { data: app } = await supabase.from('applicants').select('match_score, cancellation_count, no_response_count, match_flags').eq('id', applicantId).single();
  if (!app) return;

  const newCount = (app[field] || 0) + 1;
  const newScore = Math.max(0, (app.match_score || 0) - 5); // 0.5 * 10 (scores stored as x10)
  const flags = app.match_flags || [];

  const totalIssues = (type === 'cancellation' ? newCount : (app.cancellation_count || 0)) +
                      (type === 'no_response' ? newCount : (app.no_response_count || 0));

  if (totalIssues >= 2 && !flags.includes('Reliability warning: multiple cancellations or no-shows')) {
    flags.push('Reliability warning: multiple cancellations or no-shows');
  }

  await supabase.from('applicants').update({
    [field]: newCount,
    match_score: newScore,
    match_flags: flags,
  }).eq('id', applicantId);
}

// ═══════════════════════════════════════════
// TELEGRAM HELPER
// ═══════════════════════════════════════════
async function sendTg(token: string, chatId: number, text: string, extra?: any) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.ok) console.error('[reminder] TG error:', JSON.stringify(result));
  } catch (e) {
    console.error('[reminder] Send error:', e);
  }
}
