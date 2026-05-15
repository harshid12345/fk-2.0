import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WA_API = 'https://graph.facebook.com/v19.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendWAText(phoneNumberId: string, token: string, to: string, text: string): Promise<string | null> {
  const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text.substring(0, 4096) },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[whatsapp-notify-tenant] WA API error:', JSON.stringify(data));
    return null;
  }
  return data.messages?.[0]?.id || null;
}

async function sendWAList(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  rows: { id: string; title: string }[],
  buttonLabel = 'Pick a time',
): Promise<string | null> {
  const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText.substring(0, 1024) },
        action: {
          button: buttonLabel.substring(0, 20),
          sections: [{
            title: 'Available times',
            rows: rows.slice(0, 10).map(r => ({
              id: r.id,
              title: r.title.substring(0, 24),
            })),
          }],
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[whatsapp-notify-tenant] WA list API error:', JSON.stringify(data));
    return null;
  }
  return data.messages?.[0]?.id || null;
}

function generateAvailableSlots(
  schedule: any[],
  existingBookings: any[],
  weeksAhead = 2,
): { start: string; end: string; label: string }[] {
  const slots: { start: string; end: string; label: string }[] = [];
  const now = new Date();
  const SLOT_DURATION = 30;
  const BREAK_DURATION = 10;

  for (let dayOffset = 1; dayOffset <= weeksAhead * 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = (date.getDay() + 6) % 7; // 0=Monday, 6=Sunday

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
        const label =
          slotStart.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) +
          ' at ' +
          slotStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label });
      }
      currentMinutes += SLOT_DURATION + BREAK_DURATION;
    }
  }
  return slots;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('[whatsapp-notify-tenant] Missing WhatsApp credentials');
    return new Response(JSON.stringify({ success: false, error: 'WhatsApp credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const { applicantId, action, bookingId, slotLabel, customMessage } = body;

    if (!applicantId || !action) {
      return new Response(JSON.stringify({ success: false, error: 'applicantId and action are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch applicant
    const { data: applicant, error: appErr } = await supabase
      .from('applicants').select('*').eq('id', applicantId).maybeSingle();

    if (appErr || !applicant) {
      console.error('[whatsapp-notify-tenant] Applicant not found:', appErr?.message);
      return new Response(JSON.stringify({ success: false, error: 'Applicant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const waPhone = applicant.whatsapp_phone;
    if (!waPhone) {
      console.error('[whatsapp-notify-tenant] No whatsapp_phone for applicant:', applicantId);
      return new Response(JSON.stringify({ success: false, error: 'Applicant has no WhatsApp phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (applicant.full_name || 'there').split(' ')[0];

    // Fetch property (need landlord_id for approve slot lookup)
    const { data: property } = await supabase
      .from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).maybeSingle();
    const address = property?.address || 'the property';
    const landlordId = property?.landlord_id;

    let stageUpdate: string | null = null;

    // ── APPROVE ──────────────────────────────────────────────────────────────
    if (action === 'approve') {
      stageUpdate = 'approved';

      // Update stage first so DB is consistent even if WA fails
      const { error: stageErr } = await supabase
        .from('applicants').update({ stage: stageUpdate }).eq('id', applicantId);
      if (stageErr) console.error('[whatsapp-notify-tenant] Stage update error:', stageErr.message);

      if (!landlordId) {
        const messageId = await sendWAText(PHONE_NUMBER_ID, ACCESS_TOKEN, waPhone,
          `Hey ${firstName}! Great news — the landlord loved your application for ${address}.\n\nThey'll be in touch with available viewing times very soon. Hang tight!`
        );
        console.log(`[whatsapp-notify-tenant] approve (no landlord) sent to ${waPhone}, messageId=${messageId}`);
        return new Response(JSON.stringify({ success: true, messageId }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch landlord's viewing schedule
      const { data: schedule } = await supabase
        .from('viewing_schedule').select('*').eq('landlord_id', landlordId);
      console.log('[whatsapp-notify-tenant] schedule entries:', schedule?.length ?? 0);

      if (!schedule || schedule.length === 0) {
        const messageId = await sendWAText(PHONE_NUMBER_ID, ACCESS_TOKEN, waPhone,
          `Hey ${firstName}! The landlord really liked your profile for ${address}.\n\nThey're setting up viewing times — I'll send you options as soon as they're ready!`
        );
        console.log(`[whatsapp-notify-tenant] approve (no schedule) sent to ${waPhone}, messageId=${messageId}`);
        return new Response(JSON.stringify({ success: true, messageId }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch existing bookings to exclude booked slots
      const { data: bookings } = await supabase
        .from('viewing_bookings').select('*').eq('landlord_id', landlordId);

      const slots = generateAvailableSlots(schedule, bookings || []);
      console.log('[whatsapp-notify-tenant] available slots:', slots.length);

      if (slots.length === 0) {
        const messageId = await sendWAText(PHONE_NUMBER_ID, ACCESS_TOKEN, waPhone,
          `Hey ${firstName}! Your application for ${address} was approved.\n\nAll viewing slots are taken right now, but I'll message you the moment one opens up!`
        );
        console.log(`[whatsapp-notify-tenant] approve (no slots) sent to ${waPhone}, messageId=${messageId}`);
        return new Response(JSON.stringify({ success: true, messageId }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Take up to 6 slots, persist them, send as a list message
      const displaySlots = slots.slice(0, 6);

      const { error: slotErr } = await supabase
        .from('applicants').update({ pending_viewing_slots: JSON.stringify(displaySlots) }).eq('id', applicantId);
      if (slotErr) console.error('[whatsapp-notify-tenant] Failed to save pending slots:', slotErr.message);
      else console.log('[whatsapp-notify-tenant] Saved', displaySlots.length, 'pending slots');

      const bodyText = `Great news ${firstName} — the landlord would love to show you the place at ${address}. Pick a time below:`;

      const messageId = await sendWAList(
        PHONE_NUMBER_ID, ACCESS_TOKEN, waPhone,
        bodyText,
        displaySlots.map((slot, i) => ({ id: `vslot_${i}`, title: slot.label })),
        'Pick a time',
      );

      console.log(`[whatsapp-notify-tenant] approve (${displaySlots.length} slots) sent to ${waPhone}, messageId=${messageId}`);
      return new Response(JSON.stringify({ success: true, messageId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageText = '';

    // ── REJECT ───────────────────────────────────────────────────────────────
    if (action === 'reject') {
      stageUpdate = 'rejected';
      messageText =
        `Hi ${firstName},\n\n` +
        `Thanks so much for taking the time to apply for ${address}. ` +
        `The landlord has decided to go in a different direction this time.\n\n` +
        `I know it's not the news you were hoping for, but don't give up — the right place is out there. ` +
        `Good luck with your search.`;
    }

    // ── CONFIRM BOOKING ──────────────────────────────────────────────────────
    else if (action === 'confirm_booking') {
      stageUpdate = 'viewing_booked';

      // Resolve viewing date: prefer slotLabel, fall back to booking row
      let displayDate = slotLabel || null;
      if (!displayDate && bookingId) {
        const { data: booking } = await supabase
          .from('viewing_bookings').select('slot_start').eq('id', bookingId).maybeSingle();
        if (booking?.slot_start) {
          const dt = new Date(booking.slot_start);
          displayDate =
            dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) +
            ' at ' +
            dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
      }

      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      messageText =
        `It's confirmed, ${firstName}!\n\n` +
        `Your viewing is booked:\n` +
        `${displayDate ? `Date: ${displayDate}\n` : ''}` +
        `Address: ${address}\n` +
        `${mapsLink}\n\n` +
        `Arrive a couple of minutes early — the landlord is looking forward to meeting you.`;

      if (bookingId) {
        await supabase.from('viewing_bookings')
          .update({ status: 'confirmed' } as any).eq('id', bookingId);
      }
    }

    // ── CUSTOM MESSAGE ───────────────────────────────────────────────────────
    else if (action === 'message') {
      if (!customMessage) {
        return new Response(JSON.stringify({ success: false, error: 'customMessage required for action=message' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      messageText = `Message from your landlord:\n\n${customMessage}`;
    }

    else {
      return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update applicant stage before sending (so the DB is consistent even if WA fails)
    if (stageUpdate) {
      const { error: stageErr } = await supabase
        .from('applicants').update({ stage: stageUpdate }).eq('id', applicantId);
      if (stageErr) console.error('[whatsapp-notify-tenant] Stage update error:', stageErr.message);
    }

    // Send the WhatsApp message (all non-approve actions use plain text)
    const messageId = await sendWAText(PHONE_NUMBER_ID, ACCESS_TOKEN, waPhone, messageText);

    if (!messageId) {
      return new Response(JSON.stringify({ success: false, error: 'WhatsApp API did not return a message ID' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[whatsapp-notify-tenant] Sent action=${action} to ${waPhone}, messageId=${messageId}`);
    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[whatsapp-notify-tenant] Unhandled error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
