import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

function googleMapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  if (!BOT_TOKEN) {
    console.error('[notify] TELEGRAM_SCREENER_TOKEN missing');
    return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { applicantId, action, customMessage } = body;
    console.log('[notify] Received:', JSON.stringify({ applicantId, action }));

    if (!applicantId || !action) {
      console.error('[notify] Missing applicantId or action');
      return new Response(JSON.stringify({ error: 'applicantId and action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch applicant
    const { data: applicant, error: appErr } = await supabase
      .from('applicants').select('*').eq('id', applicantId).maybeSingle();

    if (appErr || !applicant) {
      console.error('[notify] Applicant not found:', appErr?.message);
      return new Response(JSON.stringify({ ok: false, error: 'Applicant not found or was deleted' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[notify] Applicant found:', applicant.full_name, 'chat_id:', applicant.telegram_chat_id, 'user_id:', applicant.telegram_user_id);

    // Resolve chat ID — try telegram_chat_id first, fall back to telegram_user_id
    const chatId = applicant.telegram_chat_id 
      ? Number(applicant.telegram_chat_id) 
      : (applicant.telegram_user_id ? Number(applicant.telegram_user_id) : null);
    
    if (!chatId) {
      console.error('[notify] No chat ID for applicant:', applicantId);
      return new Response(JSON.stringify({ error: 'No Telegram chat ID found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (applicant.full_name || 'there').split(' ')[0];

    // Fetch property
    const { data: property, error: propErr } = await supabase
      .from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();

    if (propErr) {
      console.error('[notify] Property fetch error:', propErr.message);
    }

    const address = property?.address || 'the property';
    const mapsLink = googleMapsLink(address);
    const landlordId = property?.landlord_id;

    // ─── APPROVE ───
    if (action === 'approve') {
      console.log('[notify] Processing approval for', firstName);
      
      // Update stage
      const { error: updateErr } = await supabase.from('applicants').update({ stage: 'approved' }).eq('id', applicantId);
      if (updateErr) console.error('[notify] Stage update error:', updateErr.message);

      if (!landlordId) {
        console.log('[notify] No landlord ID, sending basic approval');
        await sendTg(BOT_TOKEN, chatId,
          `Hey ${firstName}! Great news — the landlord loved your application for <b>${address}</b> 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nThey'll be in touch about a viewing soon!`
        );
        return ok(corsHeaders);
      }

      // Get landlord's viewing schedule
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlordId);
      console.log('[notify] Schedule entries:', schedule?.length || 0);

      if (!schedule || schedule.length === 0) {
        await sendTg(BOT_TOKEN, chatId,
          `Hey ${firstName}! The landlord really liked your profile for <b>${address}</b> 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nThey're setting up viewing times — I'll send you options as soon as they're ready!`
        );
        return ok(corsHeaders);
      }

      // Get existing bookings to find available slots
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlordId);
      console.log('[notify] Existing bookings:', bookings?.length || 0);

      const slots = generateAvailableSlots(schedule, bookings || []);
      console.log('[notify] Available slots generated:', slots.length);

      if (slots.length === 0) {
        await sendTg(BOT_TOKEN, chatId,
          `Hey ${firstName}! Your application for <b>${address}</b> was approved 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nAll viewing slots are taken right now, but I'll message you the moment one opens up!`
        );
        return ok(corsHeaders);
      }

      // Show up to 6 slots
      const displaySlots = slots.slice(0, 6);
      const buttons = displaySlots.map((slot, i) => [{ text: `📅 ${slot.label}`, callback_data: `vslot_${i}` }]);

      // IMPORTANT: Persist the slots so the screener webhook can look them up when tenant taps a button
      const { error: slotErr } = await supabase.from('applicants').update({
        pending_viewing_slots: JSON.stringify(displaySlots),
      }).eq('id', applicantId);
      if (slotErr) console.error('[notify] Failed to save pending slots:', slotErr.message);
      else console.log('[notify] Saved', displaySlots.length, 'pending slots');

      // Build conversational message
      let msg: string;
      if (displaySlots.length === 1) {
        msg = `Hey ${firstName}! Great news — the landlord would love to show you <b>${address}</b> 🏠\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nHow does <b>${displaySlots[0].label}</b> work for you?`;
      } else {
        msg = `Hey ${firstName}! Great news — the landlord would love to show you <b>${address}</b> 🏠\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nWould <b>${displaySlots[0].label}</b> work for you? If not, I've got a few other times below 👇`;
      }

      await sendTg(BOT_TOKEN, chatId, msg, { reply_markup: { inline_keyboard: buttons } });
      return ok(corsHeaders);
    }

    // ─── CONFIRM BOOKING (landlord approves a specific time slot the tenant picked) ───
    if (action === 'confirm_booking') {
      console.log('[notify] Processing booking confirmation for', firstName);
      const { slotStart, slotLabel } = body;

      // Update applicant stage
      await supabase.from('applicants').update({ stage: 'viewing_booked' }).eq('id', applicantId);

      // Update booking status if booking ID provided
      if (body.bookingId) {
        await supabase.from('viewing_bookings').update({ status: 'confirmed' } as any).eq('id', body.bookingId);
      }

      const slotDisplay = slotLabel || (slotStart ? new Date(slotStart).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'your scheduled time');

      await sendTg(BOT_TOKEN, chatId,
        `Hey ${firstName}! 🎉 You're all set!\n\nYour viewing at <b>${address}</b> is confirmed for <b>${slotDisplay}</b>.\n\n📍 <a href="${mapsLink}">Get directions on Google Maps</a>\n\nJust show up a couple minutes early — the landlord is looking forward to meeting you! See you there 🏠✨`
      );
      return ok(corsHeaders);
    }

    // ─── REJECT ───
    if (action === 'reject') {
      console.log('[notify] Processing rejection for', firstName);
      
      const { error: updateErr } = await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicantId);
      if (updateErr) console.error('[notify] Stage update error:', updateErr.message);

      await sendTg(BOT_TOKEN, chatId,
        `Hi ${firstName},\n\nThanks so much for taking the time to apply for <b>${address}</b>. The landlord has decided to go in a different direction this time.\n\nI know it's not the news you were hoping for, but the right place is out there! Good luck with your search 💪🏠`
      );
      return ok(corsHeaders);
    }

    // ─── CUSTOM MESSAGE ───
    if (action === 'message') {
      await sendTg(BOT_TOKEN, chatId, `Hey ${firstName}, message from the landlord:\n\n${customMessage}`);
      return ok(corsHeaders);
    }

    return ok(corsHeaders);
  } catch (error) {
    console.error('[notify] Unhandled error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendTg(token: string, chatId: number, text: string, extra?: any) {
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false, ...extra };
  console.log('[notify] Sending to chat', chatId, '- text length:', text.length);
  
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.ok) {
      console.error('[notify] Telegram API error:', JSON.stringify(result));
    } else {
      console.log('[notify] ✅ Message sent successfully to chat', chatId);
    }
    return result;
  } catch (e) {
    console.error('[notify] Fetch error sending to Telegram:', e);
    return { ok: false, error: String(e) };
  }
}

function generateAvailableSlots(schedule: any[], existingBookings: any[], weeksAhead = 2): { start: string; end: string; label: string }[] {
  const slots: { start: string; end: string; label: string }[] = [];
  const now = new Date();
  const SLOT_DURATION = 30;
  const BREAK_DURATION = 10;

  for (let dayOffset = 1; dayOffset <= weeksAhead * 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = (date.getDay() + 6) % 7;

    const daySchedule = schedule.find((s: any) => s.day_of_week === dayOfWeek && s.enabled);
    if (!daySchedule) continue;

    const [startH, startM] = daySchedule.start_time.split(':').map(Number);
    const [endH, endM] = daySchedule.end_time.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + SLOT_DURATION <= endMinutes) {
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION);

      const isBooked = existingBookings.some((b: any) =>
        b.status !== 'cancelled_tenant' && b.status !== 'cancelled_landlord' &&
        new Date(b.slot_start).getTime() === slotStart.getTime()
      );

      if (!isBooked) {
        const label = slotStart.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) +
          ' at ' + slotStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label });
      }

      currentMinutes += SLOT_DURATION + BREAK_DURATION;
    }
  }

  return slots;
}
