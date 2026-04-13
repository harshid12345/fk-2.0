import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

function googleMapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_SCREENER_TOKEN not configured');
    return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { applicantId, action, customMessage } = await req.json();
    console.log(`[notify-tenant] action=${action} applicantId=${applicantId}`);

    if (!applicantId || !action) {
      return new Response(JSON.stringify({ error: 'applicantId and action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: applicant, error: appErr } = await supabase
      .from('applicants').select('*').eq('id', applicantId).single();

    if (appErr || !applicant) {
      console.error('[notify-tenant] Applicant not found:', appErr);
      return new Response(JSON.stringify({ error: 'Applicant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = applicant.telegram_chat_id || (applicant.telegram_user_id ? parseInt(applicant.telegram_user_id) : null);
    if (!chatId) {
      console.error('[notify-tenant] No chat ID for applicant:', applicantId);
      return new Response(JSON.stringify({ error: 'No Telegram chat ID found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (applicant.full_name || 'there').split(' ')[0];

    const { data: property } = await supabase
      .from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();

    const address = property?.address || 'the property';
    const mapsLink = googleMapsLink(address);

    if (action === 'approve') {
      // Update stage first
      await supabase.from('applicants').update({ stage: 'approved' }).eq('id', applicantId);

      const landlordId = property?.landlord_id;
      if (!landlordId) {
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! Great news — the landlord loved your application for <b>${address}</b> 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nThey'll be in touch about a viewing soon!`
        );
        return ok(corsHeaders);
      }

      // Get landlord schedule
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlordId);
      if (!schedule || schedule.length === 0) {
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! The landlord really liked your profile for <b>${address}</b> 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nThey're setting up viewing times — I'll send you options as soon as they're ready!`
        );
        return ok(corsHeaders);
      }

      // Get existing bookings to find available slots
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlordId);
      const slots = generateAvailableSlots(schedule, bookings || []);

      if (slots.length === 0) {
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! Your application for <b>${address}</b> was approved 🎉\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nAll viewing slots are taken right now, but I'll message you the moment one opens up!`
        );
        return ok(corsHeaders);
      }

      // Pick the best slots and present them conversationally
      const displaySlots = slots.slice(0, 6);
      const buttons = displaySlots.map((slot, i) => [{ text: `📅 ${slot.label}`, callback_data: `vslot_${i}` }]);

      // Persist the offered slots so the callback handler can look them up
      await supabase.from('applicants').update({
        pending_viewing_slots: JSON.stringify(displaySlots),
      }).eq('id', applicantId);

      // Conversational slot suggestion
      let msg: string;
      if (displaySlots.length === 1) {
        msg = `Hey ${firstName}! Great news — the landlord would love to show you <b>${address}</b> 🏠\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nHow does <b>${displaySlots[0].label}</b> work for you?`;
      } else {
        msg = `Hey ${firstName}! Great news — the landlord would love to show you <b>${address}</b> 🏠\n\n📍 <a href="${mapsLink}">View on Google Maps</a>\n\nWould <b>${displaySlots[0].label}</b> work for you? If not, I've got a few other times below 👇`;
      }

      await sendMessage(BOT_TOKEN, chatId, msg, { reply_markup: { inline_keyboard: buttons } });

    } else if (action === 'reject') {
      await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicantId);

      await sendMessage(BOT_TOKEN, chatId,
        `Hi ${firstName},\n\nThanks so much for taking the time to apply for <b>${address}</b>. The landlord has decided to go in a different direction this time.\n\nI know it's not the news you were hoping for, but the right place is out there! Good luck with your search 💪🏠`
      );

    } else if (action === 'message') {
      await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}, message from the landlord:\n\n${customMessage}`);
    }

    return ok(corsHeaders);
  } catch (error) {
    console.error('[notify-tenant] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendMessage(token: string, chatId: number, text: string, extra?: any) {
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false, ...extra }),
  });
  const result = await res.json();
  if (!result.ok) {
    console.error('[notify-tenant] Telegram sendMessage failed:', JSON.stringify(result));
  } else {
    console.log('[notify-tenant] Message sent to chat:', chatId);
  }
  return result;
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
