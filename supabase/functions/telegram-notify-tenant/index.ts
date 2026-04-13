import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

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
    return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { applicantId, action, customMessage } = await req.json();

    if (!applicantId || !action) {
      return new Response(JSON.stringify({ error: 'applicantId and action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up applicant with property info
    const { data: applicant, error: appErr } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', applicantId)
      .single();

    if (appErr || !applicant) {
      return new Response(JSON.stringify({ error: 'Applicant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use telegram_chat_id first, fall back to telegram_user_id
    const chatId = applicant.telegram_chat_id || (applicant.telegram_user_id ? parseInt(applicant.telegram_user_id) : null);
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'No Telegram chat ID found for this applicant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: property } = await supabase
      .from('landlord_properties')
      .select('address, landlord_id')
      .eq('id', applicant.property_id)
      .single();

    const name = applicant.full_name || 'there';
    const address = property?.address || 'the property';

    if (action === 'approve') {
      // Update stage
      await supabase.from('applicants').update({ stage: 'approved' }).eq('id', applicantId);

      // Get landlord schedule to generate slots
      const landlordId = property?.landlord_id;
      if (!landlordId) {
        await sendMessage(BOT_TOKEN, chatId, `Great news, ${name}! 🎉\n\nThe landlord at <b>${address}</b> has approved your application. They will be in touch soon to arrange a viewing.`);
        return ok(corsHeaders);
      }

      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlordId);
      if (!schedule || schedule.length === 0) {
        await sendMessage(BOT_TOKEN, chatId, `Great news, ${name}! 🎉\n\nThe landlord at <b>${address}</b> has approved your application. Viewing times will be shared soon! 🏠`);
        return ok(corsHeaders);
      }

      // Get existing bookings
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlordId);
      const slots = generateAvailableSlots(schedule, bookings || []);

      if (slots.length === 0) {
        await sendMessage(BOT_TOKEN, chatId, `Great news, ${name}! 🎉\n\nThe landlord at <b>${address}</b> has approved your application. All viewing slots are currently full — we'll notify you when new ones open up.`);
        return ok(corsHeaders);
      }

      // Show max 8 slots
      const displaySlots = slots.slice(0, 8);
      const buttons = displaySlots.map((slot, i) => [{ text: slot.label, callback_data: `vslot_${i}` }]);

      // Store available slots temporarily for callback reference
      await supabase.from('applicants').update({
        viewing_slots: JSON.stringify(displaySlots),
      } as any).eq('id', applicantId);

      await sendMessage(BOT_TOKEN, chatId,
        `Great news, ${name}! 🎉\n\nThe landlord at <b>${address}</b> would like to invite you for a viewing.\n\nPlease pick a time that works for you:`,
        { reply_markup: { inline_keyboard: buttons } }
      );
    } else if (action === 'reject') {
      await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicantId);

      await sendMessage(BOT_TOKEN, chatId,
        `Hi ${name},\n\nThank you for your interest in <b>${address}</b>. Unfortunately, the landlord has decided to proceed with other applicants at this time.\n\nWe wish you the best in your search! 🏠`
      );
    } else if (action === 'message') {
      await sendMessage(BOT_TOKEN, chatId, `Message from the landlord:\n\n${customMessage}`);
    }

    return ok(corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendMessage(token: string, chatId: number, text: string, extra?: any) {
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
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

      const startISO = slotStart.toISOString();
      const endISO = slotEnd.toISOString();

      const isBooked = existingBookings.some((b: any) =>
        b.status !== 'cancelled_tenant' && b.status !== 'cancelled_landlord' &&
        new Date(b.slot_start).getTime() === slotStart.getTime()
      );

      if (!isBooked) {
        const label = slotStart.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
          ', ' + slotStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        slots.push({ start: startISO, end: endISO, label });
      }

      currentMinutes += SLOT_DURATION + BREAK_DURATION;
    }
  }

  return slots;
}
