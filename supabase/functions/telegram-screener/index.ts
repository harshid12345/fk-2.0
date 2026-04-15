import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// ═══════════════════════════════════════════
// SCREENING QUESTIONS — conversational style
// ═══════════════════════════════════════════
const SCREENING_QUESTIONS = [
  {
    id: 'occupants', stage: 'q_occupants',
    question: (name: string) => `So ${name}, will you be living there on your own or with others?`,
    options: [
      { text: "Just me", callback: 'occ_1' },
      { text: "2 of us", callback: 'occ_2' },
      { text: "3 people", callback: 'occ_3' },
      { text: "4+", callback: 'occ_4' },
    ],
    dbField: 'num_occupants',
    valueMap: { occ_1: 'Just me', occ_2: '2 people', occ_3: '3 people', occ_4: '4+' },
    nextStage: 'q_move_in',
    followUp: { occ_1: "Nice, solo living it is!", occ_2: "Got it, room for two!", occ_3: "Alright, party of three!", occ_4: "The more the merrier!" },
  },
  {
    id: 'move_in_date', stage: 'q_move_in',
    question: (_: string) => "When are you hoping to move in? No pressure, just a rough idea.",
    options: [
      { text: "ASAP / this month", callback: 'move_this' },
      { text: "Next month", callback: 'move_next' },
      { text: "In 2-3 months", callback: 'move_later' },
      { text: "I'm flexible", callback: 'move_flex' },
    ],
    dbField: 'desired_move_in',
    valueMap: { move_this: 'This month', move_next: 'Next month', move_later: 'In 2-3 months', move_flex: 'Flexible' },
    nextStage: 'q_employment',
    followUp: { move_this: "Alright, let's get you sorted quickly then!", move_next: "Cool, that gives us some time.", move_later: "No rush, good to plan ahead!", move_flex: "Flexible is great, keeps options open!" },
  },
  {
    id: 'employment', stage: 'q_employment',
    question: (_: string) => "What do you do for work? Just so we can get an idea of your situation.",
    options: [
      { text: "Employed (loondienst)", callback: 'emp_loon' },
      { text: "Self-employed (ZZP)", callback: 'emp_zzp' },
      { text: "Student", callback: 'emp_student' },
      { text: "Uitkering (benefits)", callback: 'emp_uitkering' },
    ],
    dbField: 'employment_type',
    valueMap: { emp_loon: 'Loondienst (employed)', emp_zzp: 'ZZP (self-employed)', emp_student: 'Student', emp_uitkering: 'Uitkering (benefits)' },
    nextStage: 'q_income',
    followUp: { emp_loon: "Steady job, nice!", emp_zzp: "Entrepreneurial spirit!", emp_student: "Student life!", emp_uitkering: "Noted, no worries." },
  },
  {
    id: 'income', stage: 'q_income',
    question: (_: string) => "Roughly what's your gross monthly income? This stays private, just helps with the matching.",
    options: [
      { text: "Under \u20AC1,500", callback: 'inc_1' },
      { text: "\u20AC1,500 \u2013 \u20AC2,500", callback: 'inc_2' },
      { text: "\u20AC2,500 \u2013 \u20AC3,500", callback: 'inc_3' },
      { text: "\u20AC3,500 \u2013 \u20AC5,000", callback: 'inc_4' },
      { text: "\u20AC5,000+", callback: 'inc_5' },
    ],
    dbField: 'monthly_income',
    valueMap: { inc_1: 1250, inc_2: 2000, inc_3: 3000, inc_4: 4250, inc_5: 5500 },
    incomeRange: { inc_1: 'Under \u20AC1,500', inc_2: '\u20AC1,500 - \u20AC2,500', inc_3: '\u20AC2,500 - \u20AC3,500', inc_4: '\u20AC3,500 - \u20AC5,000', inc_5: '\u20AC5,000+' },
    nextStage: 'q_lease',
    followUp: { inc_1: "Thanks for sharing that.", inc_2: "Got it!", inc_3: "Solid, thanks!", inc_4: "Great, thanks!", inc_5: "Awesome, noted!" },
  },
  {
    id: 'lease_length', stage: 'q_lease',
    question: (_: string) => "How long are you looking to stay? Landlords always love long-term tenants.",
    options: [
      { text: "~6 months", callback: 'lease_6' },
      { text: "About a year", callback: 'lease_12' },
      { text: "2+ years", callback: 'lease_2plus' },
      { text: "As long as possible!", callback: 'lease_max' },
    ],
    dbField: 'desired_lease_length',
    valueMap: { lease_6: '6 months', lease_12: '12 months', lease_2plus: '2+ years', lease_max: 'As long as possible' },
    nextStage: 'q_smoking',
    followUp: { lease_6: "Short and sweet.", lease_12: "A year is a great start!", lease_2plus: "Commitment, love it!", lease_max: "Perfect, landlords love hearing that!" },
  },
  {
    id: 'smoking', stage: 'q_smoking',
    question: (_: string) => "Quick one — do you smoke?",
    options: [
      { text: "Nope", callback: 'smoke_no' },
      { text: "Only outside", callback: 'smoke_outside' },
      { text: "Yes", callback: 'smoke_yes' },
    ],
    dbField: 'lifestyle_answers', lifestyleKey: 'smoking',
    valueMap: { smoke_no: 'No', smoke_outside: 'Outside only', smoke_yes: 'Yes' },
    nextStage: 'q_pets',
    followUp: { smoke_no: "Fresh air all the way!", smoke_outside: "Fair enough!", smoke_yes: "No judgement!" },
  },
  {
    id: 'pets', stage: 'q_pets',
    question: (_: string) => "Any furry (or scaly) friends coming along?",
    options: [
      { text: "No pets", callback: 'pets_none' },
      { text: "Cat", callback: 'pets_cat' },
      { text: "Dog", callback: 'pets_dog' },
      { text: "Other", callback: 'pets_other' },
    ],
    dbField: 'lifestyle_answers', lifestyleKey: 'pets',
    valueMap: { pets_none: 'No pets', pets_cat: 'Cat', pets_dog: 'Dog', pets_other: 'Other' },
    nextStage: 'q_bkr',
    followUp: { pets_none: "Pet-free zone, noted!", pets_cat: "Cats are great roommates.", pets_dog: "Who doesn't love a good dog!", pets_other: "Interesting, noted!" },
  },
  {
    id: 'bkr', stage: 'q_bkr',
    question: (_: string) => "Last lifestyle question — any BKR registrations or past rent arrears we should know about?",
    options: [
      { text: "Nope, all clean", callback: 'bkr_clean' },
      { text: "Yes, happy to explain", callback: 'bkr_yes' },
    ],
    dbField: 'bkr_status',
    valueMap: { bkr_clean: 'No, clean record', bkr_yes: 'Yes, I can explain' },
    nextStage: 'consent',
    followUp: { bkr_clean: "Clean slate, perfect!", bkr_yes: "Transparency is appreciated, thanks for being upfront." },
  },
];

// ═══════════════════════════════════════════
// MATCH SCORE
// ═══════════════════════════════════════════
function getIncomeEstimate(range: string | null): number {
  switch (range) {
    case 'Under €1,500': return 1250;
    case '€1,500 - €2,500': return 2000;
    case '€2,500 - €3,500': return 3000;
    case '€3,500 - €5,000': return 4250;
    case '€5,000+': return 5500;
    default: return 0;
  }
}

function getOccupantNumber(text: string | null): number {
  switch (text) {
    case 'Just me': return 1; case '2 people': return 2; case '3 people': return 3; case '4+': return 4; default: return 1;
  }
}

function calculateMatchScore(tenant: any, criteria: any, propertyRent: number, scrapeData: any) {
  const flags: string[] = [];
  const answers = tenant.lifestyle_answers || {};
  const smoking = answers.smoking || null;
  const pets = answers.pets || null;
  const incomeRange = answers.income_range || null;
  const incomeEstimate = incomeRange ? getIncomeEstimate(incomeRange) : (tenant.monthly_income || 0);

  if (criteria?.smoking_allowed === 'No' && smoking === 'Yes')
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Landlord does not allow smoking — tenant smokes', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: smoking'] };
  if (criteria?.pets_allowed === 'No' && pets && pets !== 'No pets')
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Landlord does not allow pets — tenant has pets', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: pets'] };
  if (incomeEstimate > 0 && propertyRent > 0 && incomeEstimate < propertyRent * 2)
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Income below 2x monthly rent', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: income too low'] };
  if (tenant.bkr_status === 'Yes, I can explain')
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Self-reported BKR registration or rent arrears', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: BKR/arrears'] };

  let pref = 0;
  if (criteria?.smoking_allowed === 'Yes' || smoking === 'No') pref += 1;
  else if (criteria?.smoking_allowed === 'Outside only' && smoking === 'Outside only') pref += 1;
  else { pref -= 1; flags.push('Smoking preference mismatch'); }
  if (criteria?.pets_allowed === 'Yes' || !pets || pets === 'No pets') pref += 1;
  else if (criteria?.pets_allowed === 'Negotiable') { pref += 0.5; flags.push('Tenant has pets — landlord says negotiable'); }
  else { pref -= 1; flags.push('Pets preference mismatch'); }
  const occ = getOccupantNumber(tenant.num_occupants);
  if (occ <= (criteria?.max_occupants || 1)) pref += 1; else { pref -= 1; flags.push('Too many occupants'); }
  if (tenant.desired_move_in === 'This month' || tenant.desired_move_in === 'Next month') pref += 1;
  else if (tenant.desired_move_in === 'Flexible') pref += 0.5;
  else { pref -= 0.5; flags.push('Move-in date may not align'); }
  pref = Math.max(0, Math.min(4, pref));

  let fin = 0;
  const ratio = propertyRent > 0 ? incomeEstimate / propertyRent : 0;
  if (ratio >= 3) fin += 2.0; else if (ratio >= 2.5) fin += 1.0;
  switch (tenant.employment_type) {
    case 'Loondienst (employed)': fin += 1.0; break;
    case 'ZZP (self-employed)': fin += (scrapeData?.kvk?.yearsActive >= 2 ? 0.75 : 0.25); break;
    case 'Student': case 'Uitkering (benefits)': fin += 0.25; flags.push('Employment type: limited financial stability'); break;
    default: fin += 0.25;
  }
  fin += 0.5;
  fin = Math.max(0, Math.min(4, fin));

  let scr = scrapeData ? 0 : 1.0;
  if (scrapeData) {
    if (scrapeData.linkedin?.confirmsEmployer) scr += 0.5;
    if (scrapeData.kvk?.confirmed) scr += 0.5;
    if (scrapeData.socialConsistent) scr += 0.25;
    if (scrapeData.socialAccountAge >= 2) scr += 0.25;
    if (scrapeData.google?.noNegativeResults) scr += 0.5;
    else if (scrapeData.google?.negativeResults) { scr -= 0.5; flags.push('Negative mentions found'); }
  }
  scr = Math.max(0, Math.min(2, scr));

  const total = Math.round((pref + fin + scr) * 10) / 10;
  let label: string;
  if (total >= 8.5) label = 'Strong match'; else if (total >= 6.5) label = 'Good match';
  else if (total >= 4.5) label = 'Moderate match'; else label = 'Weak match';
  return { score: total, label, hardDisqualified: false, hardDisqualifyReason: null, breakdown: { preferenceScore: pref, financialScore: fin, scrapedScore: scr }, flags };
}

// ═══════════════════════════════════════════
// SLOT GENERATION - 30 min slots, 10 min breaks
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// CONVERSATIONAL SLOT SUGGESTION
// ═══════════════════════════════════════════
function buildSlotMessage(name: string, address: string, slots: { start: string; end: string; label: string }[]): string {
  const firstName = name.split(' ')[0] || name;
  // Suggest the best slot naturally, then offer alternatives
  if (slots.length === 1) {
    return `Hey ${firstName}! Great news — the landlord would love to show you the place at <b>${address}</b> 🏠\n\nHow does <b>${slots[0].label}</b> work for you?`;
  }
  
  const best = slots[0];
  return `Hey ${firstName}! Great news — the landlord would love to show you the place at <b>${address}</b> 🏠\n\nWould <b>${best.label}</b> work for you? If not, I've got a few other times below 👇`;
}

// ═══════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  if (!BOT_TOKEN) return new Response('Server error', { status: 500 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    // ═══════════════════════════════════════════
    // INTERNAL ACTIONS (called from frontend)
    // ═══════════════════════════════════════════
    if (body.action === 'send_slots') {
      const { applicant_id, property_id, landlord_id } = body;

      // Get the applicant for chat id and name
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ error: 'Applicant not found' }), { status: 404 });

      const chatId = appData.telegram_chat_id || (appData.telegram_user_id ? parseInt(appData.telegram_user_id) : null);
      if (!chatId) return new Response(JSON.stringify({ error: 'No chat ID' }), { status: 400 });

      const firstName = (appData.full_name || 'there').split(' ')[0];

      // Get property address
      const { data: propData } = await supabase.from('landlord_properties').select('address').eq('id', property_id).single();
      const address = propData?.address || 'the property';

      // Get landlord schedule
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlord_id);
      if (!schedule || schedule.length === 0) {
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! The landlord loved your profile and wants to meet you 🎉 They're setting up viewing times right now — I'll send you the options as soon as they're ready!`
        );
        return new Response(JSON.stringify({ ok: true }));
      }

      // Get existing bookings
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlord_id);
      const slots = generateAvailableSlots(schedule, bookings || []);

      if (slots.length === 0) {
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! The landlord loved your application 🎉 All viewing times are full right now, but I'll message you the moment a slot opens up!`
        );
        return new Response(JSON.stringify({ ok: true }));
      }

      // Show max 6 slots with conversational message
      const displaySlots = slots.slice(0, 6);
      const buttons = displaySlots.map((slot, i) => [{ text: `📅 ${slot.label}`, callback_data: `vslot_${i}` }]);

      // Store slots in the new column so callbacks can find them
      await supabase.from('applicants').update({ 
        pending_viewing_slots: JSON.stringify(displaySlots)
      }).eq('id', applicant_id);

      const msg = buildSlotMessage(appData.full_name || 'there', address, displaySlots);
      await sendMessage(BOT_TOKEN, chatId, msg, { reply_markup: { inline_keyboard: buttons } });
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_rejection') {
      const { applicant_id } = body;
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ ok: true }));

      const chatId = appData.telegram_chat_id || (appData.telegram_user_id ? parseInt(appData.telegram_user_id) : null);
      if (!chatId) return new Response(JSON.stringify({ ok: true }));

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const { data: propData } = await supabase.from('landlord_properties').select('address').eq('id', appData.property_id).single();
      const address = propData?.address || 'the property';

      await sendMessage(BOT_TOKEN, chatId,
        `Hi ${firstName},\n\nThanks so much for taking the time to apply for <b>${address}</b>. The landlord has decided to go in a different direction this time.\n\nI know it's not the news you were hoping for, but don't give up — the right place is out there! If new properties come up, I'll let you know. Good luck with your search 💪🏠`
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_confirmation') {
      const { applicant_id, slot_start, address } = body;
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ ok: true }));

      const chatId = appData.telegram_chat_id || (appData.telegram_user_id ? parseInt(appData.telegram_user_id) : null);
      if (!chatId) return new Response(JSON.stringify({ ok: true }));

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const dt = new Date(slot_start);
      const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

      await sendMessage(BOT_TOKEN, chatId,
        `It's official, ${firstName}! ✅\n\nYour viewing is confirmed:\n\n🗓 <b>${dateStr} at ${timeStr}</b>\n📍 <b>${address}</b>\n🗺 <a href="${mapsLink}">Open in Google Maps</a>\n\nI'll send you a reminder the day before. See you there! 🏠`
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_reminders') {
      await handleReminders(supabase, BOT_TOKEN);
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'offer_cancelled_slot') {
      const { booking_id } = body;
      await handleCancelledSlotReassignment(supabase, BOT_TOKEN, booking_id);
      return new Response(JSON.stringify({ ok: true }));
    }

    // ═══════════════════════════════════════════
    // TELEGRAM WEBHOOK UPDATES
    // ═══════════════════════════════════════════
    const update = body;

    // Handle callback queries
    if (update.callback_query) {
      const cbMessage = update.callback_query.message;
      const cbChatId = cbMessage.chat.id;
      const telegramUserId = String(update.callback_query.from.id);
      const callbackData = update.callback_query.data;

      const { data: applicant } = await supabase
        .from('applicants').select('*').eq('telegram_user_id', telegramUserId).maybeSingle();

      if (applicant) {
        await handleCallback(supabase, BOT_TOKEN, cbChatId, telegramUserId, applicant, callbackData);
      }

      await fetch(`${TELEGRAM_API}${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      return new Response('OK');
    }

    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const telegramUserId = String(message.from.id);
    const photo = message.photo;
    const firstName = message.from?.first_name || 'there';

    const { data: applicant } = await supabase
      .from('applicants').select('*').eq('telegram_user_id', telegramUserId).maybeSingle();

    if (!applicant) {
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const propertyId = parts[1];
        if (!propertyId) {
          await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! 👋 Looks like you found me directly — you'll need a screening link from your landlord to get started. Ask them for it!`);
          return new Response('OK');
        }
        const { data: property } = await supabase
          .from('landlord_properties').select('id, address, landlord_id').eq('id', propertyId).maybeSingle();
        if (!property) {
          await sendMessage(BOT_TOKEN, chatId, `Hmm, that link doesn't seem to work ${firstName}. Could you double-check with your landlord? 🤔`);
          return new Response('OK');
        }
        const { data: landlord } = await supabase
          .from('landlords').select('full_name').eq('id', property.landlord_id).maybeSingle();

        await supabase.from('applicants').insert({
          telegram_user_id: telegramUserId,
          telegram_chat_id: chatId,
          property_id: propertyId,
          stage: 'welcome',
        });

        const landlordName = landlord?.full_name?.split(' ')[0] || 'your landlord';
        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! 👋\n\nI'm helping ${landlordName} find the right tenant for their place at <b>${property.address}</b>.\n\nI'll ask you a few quick questions — takes about 5 minutes — and it really helps you stand out from other applicants. Ready to go?`,
          { reply_markup: { inline_keyboard: [[
            { text: "Yeah, let's do it! ✅", callback_data: 'start_yes' },
            { text: "Wait, what is this? 🤔", callback_data: 'start_info' },
          ]] } }
        );
      } else {
        await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! 👋 I'd love to help but I need a screening link from your landlord first. Ask them to share it with you!`);
      }
      return new Response('OK');
    }

    // Update chat_id if missing
    if (!applicant.telegram_chat_id) {
      await supabase.from('applicants').update({ telegram_chat_id: chatId }).eq('id', applicant.id);
    }

    if (photo && applicant.stage === 'id_check') {
      await handleIdUpload(supabase, BOT_TOKEN, chatId, applicant, photo);
      return new Response('OK');
    }

    await handleTextMessage(supabase, BOT_TOKEN, chatId, applicant, text);
    return new Response('OK');

  } catch (error) {
    console.error('Error:', error);
    return new Response('OK', { status: 200 });
  }
});

// ═══════════════════════════════════════════
// CALLBACK HANDLER
// ═══════════════════════════════════════════
async function handleCallback(supabase: any, token: string, chatId: number, telegramUserId: string, applicant: any, data: string) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];

  if (data === 'start_yes') {
    await supabase.from('applicants').update({ stage: 'name' }).eq('id', applicant.id);
    await sendMessage(token, chatId, "Awesome! Let's start with the basics — what's your full name? 😊");
    return;
  }
  if (data === 'start_info') {
    await sendMessage(token, chatId,
      `Good question! FairKamer helps landlords find their ideal tenant — fairly and transparently.\n\nI'll ask you a few things about yourself, and the landlord gets a compatibility score. No weird stuff, no hidden checks. Just honest matching.\n\nWant to give it a go?`,
      { reply_markup: { inline_keyboard: [[ { text: "Alright, let's go! ✅", callback_data: 'start_yes' } ]] } }
    );
    return;
  }

  // Screening question callbacks
  for (const q of SCREENING_QUESTIONS) {
    const matchingOption = q.options.find(o => o.callback === data);
    if (matchingOption && applicant.stage === q.stage) {
      const updateData: any = { stage: q.nextStage };
      if ((q as any).lifestyleKey) {
        const answers = applicant.lifestyle_answers || {};
        answers[(q as any).lifestyleKey] = (q.valueMap as any)[data];
        updateData.lifestyle_answers = answers;
      } else {
        updateData[q.dbField] = (q.valueMap as any)[data];
      }
      if (q.id === 'income') {
        updateData.monthly_income = (q.valueMap as any)[data];
        const answers = applicant.lifestyle_answers || {};
        answers.income_range = (q as any).incomeRange?.[data] || null;
        updateData.lifestyle_answers = answers;
      }
      await supabase.from('applicants').update(updateData).eq('id', applicant.id);

      // Send conversational follow-up, then next question
      const followUp = (q as any).followUp?.[data] || '';
      const nextQ = SCREENING_QUESTIONS.find(nq => nq.stage === q.nextStage);
      
      if (nextQ) {
        const nextQuestion = typeof nextQ.question === 'function' ? nextQ.question(firstName) : nextQ.question;
        const msg = followUp ? `${followUp}\n\n${nextQuestion}` : nextQuestion;
        await sendMessage(token, chatId, msg, {
          reply_markup: { inline_keyboard: nextQ.options.map(o => [{ text: o.text, callback_data: o.callback }]) }
        });
      } else if (q.nextStage === 'consent') {
        const msg = followUp 
          ? `${followUp}\n\nAlright ${firstName}, we're almost done! One quick legal thing — by continuing, you agree that your info may be used to verify your application under Dutch AVG/GDPR rules.\n\nJust type <b>"I agree"</b> and we'll wrap up 🙏`
          : `Almost there ${firstName}! By continuing, you agree that your info may be used to verify your application under Dutch AVG/GDPR rules.\n\nType <b>"I agree"</b> to continue 🙏`;
        await sendMessage(token, chatId, msg);
      }
      return;
    }
  }

  // Skip social
  if (data === 'skip_social') {
    await supabase.from('applicants').update({ stage: 'id_check' }).eq('id', applicant.id);
    await sendMessage(token, chatId,
      `No worries at all ${firstName}!\n\nOkay, last thing — could you snap a photo of your ID (passport or Dutch ID card)? It stays completely private and encrypted 🔒`
    );
    return;
  }

  // Viewing slot selection
  if (data.startsWith('vslot_')) {
    const slotIndex = parseInt(data.replace('vslot_', ''));
    
    // Read from the correct column
    let availableSlots: any[] = [];
    try { availableSlots = JSON.parse(applicant.pending_viewing_slots || '[]'); } catch {}
    
    const selectedSlot = availableSlots[slotIndex];
    if (!selectedSlot) {
      await sendMessage(token, chatId, `Hmm, that time doesn't seem available anymore ${firstName}. The landlord will send you fresh options soon! 🙏`);
      return;
    }

    // Get property + landlord info
    const { data: property } = await supabase.from('landlord_properties').select('landlord_id, address').eq('id', applicant.property_id).single();
    if (!property) return;

    // Verify slot is still available (double-check bookings)
    const { data: existingBooking } = await supabase.from('viewing_bookings')
      .select('id')
      .eq('landlord_id', property.landlord_id)
      .eq('slot_start', selectedSlot.start)
      .not('status', 'in', '("cancelled_tenant","cancelled_landlord")')
      .maybeSingle();

    if (existingBooking) {
      await sendMessage(token, chatId, `Oh no, someone just grabbed that slot! 😅 Let me check what else is available...`);
      // Regenerate and resend slots
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', property.landlord_id);
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', property.landlord_id);
      const freshSlots = generateAvailableSlots(schedule || [], bookings || []);
      if (freshSlots.length > 0) {
        const display = freshSlots.slice(0, 6);
        await supabase.from('applicants').update({ pending_viewing_slots: JSON.stringify(display) }).eq('id', applicant.id);
        const buttons = display.map((s, i) => [{ text: `📅 ${s.label}`, callback_data: `vslot_${i}` }]);
        await sendMessage(token, chatId, `Here are the available times — pick one that works for you:`, { reply_markup: { inline_keyboard: buttons } });
      } else {
        await sendMessage(token, chatId, `All slots are taken right now. I'll message you when new ones open up!`);
      }
      return;
    }

    // Create booking (pending landlord approval)
    const { error: bookingError } = await supabase.from('viewing_bookings').insert({
      landlord_id: property.landlord_id,
      property_id: applicant.property_id,
      applicant_id: applicant.id,
      slot_start: selectedSlot.start,
      slot_end: selectedSlot.end,
      status: 'pending_landlord',
    });

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      await sendMessage(token, chatId, `Something went wrong booking that slot. Let me try again — the landlord will send new times shortly!`);
      return;
    }

    // Update applicant
    await supabase.from('applicants').update({ 
      viewing_booked_at: selectedSlot.start,
      stage: 'viewing_pending',
      pending_viewing_slots: null, // Clear stored slots
    }).eq('id', applicant.id);

    // Create notification for landlord
    await supabase.from('notifications').insert({
      landlord_id: property.landlord_id,
      type: 'booking_request',
      title: `${firstName} picked a viewing time`,
      message: `${selectedSlot.label} at ${property.address} — approve to confirm!`,
      related_applicant_id: applicant.id,
    });

    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`;
    await sendMessage(token, chatId,
      `Nice choice, ${firstName}! 🎉\n\nYou picked <b>${selectedSlot.label}</b> at <b>${property.address}</b>.\n\n📍 <a href="${mapsLink}">Open in Google Maps</a>\n\nI've sent this to the landlord for approval — you'll get a confirmation as soon as they say yes!\n\nHang tight ⏳`
    );

    await runMatchScoring(supabase, applicant.id);
    return;
  }

  // Reminder confirmation callbacks
  if (data === 'remind_yes') {
    await sendMessage(token, chatId, `Awesome ${firstName}, see you there! 🏠✨`);
    return;
  }
  if (data === 'remind_cancel') {
    const { data: booking } = await supabase.from('viewing_bookings')
      .select('*').eq('applicant_id', applicant.id)
      .in('status', ['confirmed', 'pending_landlord'])
      .order('slot_start', { ascending: true })
      .limit(1).maybeSingle();

    if (booking) {
      await supabase.from('viewing_bookings').update({ 
        status: 'cancelled_tenant', 
        cancelled_at: new Date().toISOString() 
      }).eq('id', booking.id);

      await supabase.from('notifications').insert({
        landlord_id: booking.landlord_id,
        type: 'cancellation',
        title: `${firstName} cancelled their viewing`,
        message: `The slot has been freed up and offered to the next candidate.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });

      await sendMessage(token, chatId, `No problem ${firstName}, your viewing has been cancelled. I hope you find a great place — good luck! 🍀🏠`);

      await handleCancelledSlotReassignment(supabase, token, booking.id);
    }
    return;
  }
}

// ═══════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════
async function handleTextMessage(supabase: any, token: string, chatId: number, applicant: any, text: string) {
  const stage = applicant.stage;
  const firstName = (applicant.full_name || 'there').split(' ')[0];

  if (stage === 'name') {
    const name = text.trim();
    const first = name.split(' ')[0];
    await supabase.from('applicants').update({ full_name: name, stage: 'q_occupants' }).eq('id', applicant.id);
    const firstQ = SCREENING_QUESTIONS[0];
    const question = typeof firstQ.question === 'function' ? firstQ.question(first) : firstQ.question;
    await sendMessage(token, chatId, `Nice to meet you, ${first}! 😊\n\n${question}`, {
      reply_markup: { inline_keyboard: firstQ.options.map(o => [{ text: o.text, callback_data: o.callback }]) }
    });
    return;
  }

  if (stage === 'consent') {
    if (text.toLowerCase().includes('agree')) {
      await supabase.from('applicants').update({ consent_given: true, stage: 'socials' }).eq('id', applicant.id);
      await sendMessage(token, chatId,
        `Thanks ${firstName}! 🙏\n\nOne more optional thing — if you share your Instagram handle, it helps the landlord get a better sense of who you are. Totally up to you!\n\nDrop your handle (like @yourname) or skip it 👇`,
        { reply_markup: { inline_keyboard: [[ { text: "Skip this ⏭️", callback_data: 'skip_social' } ]] } }
      );
    } else {
      await sendMessage(token, chatId, `Just type <b>"I agree"</b> to continue, ${firstName}! 😊`);
    }
    return;
  }

  if (stage === 'socials') {
    const handle = text.replace('@', '').trim();
    await supabase.from('applicants').update({ social_handle: handle, stage: 'id_check' }).eq('id', applicant.id);
    await sendMessage(token, chatId,
      `Got it, @${handle}! 📸\n\nAlright ${firstName}, last step — could you snap a photo of your ID (passport or Dutch ID card)? It's kept completely private and secure 🔒`
    );
    return;
  }

  if (stage === 'done' || stage === 'screening_complete' || stage === 'viewing_pending' || stage === 'approved' || stage === 'viewing_booked') {
    // AI-powered free-text handler for post-screening tenants
    await handleAIResponse(supabase, token, chatId, applicant, text);
    return;
  }

  // During screening, if they type free text instead of using buttons, still try AI
  if (stage?.startsWith('q_')) {
    await sendMessage(token, chatId, `Hey ${firstName}, could you use the buttons above to answer? It helps me keep track 😊\n\nBut if you have a question, just ask!`);
    return;
  }

  // Fallback — AI handles anything we don't recognize
  await handleAIResponse(supabase, token, chatId, applicant, text);
}

// ═══════════════════════════════════════════
// ID UPLOAD
// ═══════════════════════════════════════════
async function handleIdUpload(supabase: any, token: string, chatId: number, applicant: any, photos: any[]) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const photo = photos[photos.length - 1];
  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN')!;
  const fileInfoRes = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
  const fileInfo = await fileInfoRes.json();
  const filePath = fileInfo.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  const fileBytes = await fileRes.arrayBuffer();

  const storagePath = `${applicant.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage.from('id-documents').upload(storagePath, fileBytes, { contentType: 'image/jpeg' });

  if (uploadError) {
    await sendMessage(token, chatId, `Hmm, something went wrong uploading your ID ${firstName}. Could you try sending it again? 🙏`);
    return;
  }

  await supabase.from('applicants').update({ 
    id_verified: true, 
    id_document_url: storagePath, 
    stage: 'screening_complete' 
  }).eq('id', applicant.id);

  await runMatchScoring(supabase, applicant.id);

  await sendMessage(token, chatId,
    `You're all done, ${firstName}! 🎉🎊\n\nYour screening is complete and the landlord will review your profile. If they like what they see, I'll send you available viewing times right here.\n\nThanks for going through the process — fingers crossed! 🤞🏠`
  );
}

// ═══════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════
async function handleReminders(supabase: any, token: string) {
  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const oneDayFromNow = new Date(now);
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

  const { data: threeDayBookings } = await supabase.from('viewing_bookings')
    .select('*, applicants!inner(telegram_chat_id, telegram_user_id, full_name)')
    .eq('status', 'confirmed')
    .eq('tenant_confirmed_3d', false)
    .gte('slot_start', threeDaysFromNow.toISOString().split('T')[0])
    .lt('slot_start', new Date(threeDaysFromNow.getTime() + 86400000).toISOString().split('T')[0]);

  for (const booking of (threeDayBookings || [])) {
    const { data: property } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
    const addr = property?.address || 'The property';
    const dt = new Date(booking.slot_start);
    const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const firstName = (booking.applicants?.full_name || 'there').split(' ')[0];
    const chatId = booking.applicants?.telegram_chat_id || (booking.applicants?.telegram_user_id ? parseInt(booking.applicants.telegram_user_id) : null);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

    if (chatId) {
      await sendMessage(token, chatId,
        `Hey ${firstName}! Just a heads up — your viewing is coming up in 3 days 📅\n\n🗓 <b>${dateStr} at ${timeStr}</b>\n📍 <b>${addr}</b>\n🗺 <a href="${mapsLink}">Open in Google Maps</a>\n\nStill good to go?`,
        { reply_markup: { inline_keyboard: [
          [{ text: "Yep, I'll be there! ✅", callback_data: 'remind_yes' }],
          [{ text: "I need to cancel ❌", callback_data: 'remind_cancel' }],
        ] } }
      );
      await supabase.from('viewing_bookings').update({ tenant_confirmed_3d: true }).eq('id', booking.id);
    }
  }

  const { data: oneDayBookings } = await supabase.from('viewing_bookings')
    .select('*, applicants!inner(telegram_chat_id, telegram_user_id, full_name)')
    .eq('status', 'confirmed')
    .eq('tenant_confirmed_1d', false)
    .gte('slot_start', oneDayFromNow.toISOString().split('T')[0])
    .lt('slot_start', new Date(oneDayFromNow.getTime() + 86400000).toISOString().split('T')[0]);

  for (const booking of (oneDayBookings || [])) {
    const { data: property } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
    const addr = property?.address || 'The property';
    const dt = new Date(booking.slot_start);
    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const firstName = (booking.applicants?.full_name || 'there').split(' ')[0];
    const chatId = booking.applicants?.telegram_chat_id || (booking.applicants?.telegram_user_id ? parseInt(booking.applicants.telegram_user_id) : null);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

    if (chatId) {
      await sendMessage(token, chatId,
        `Hey ${firstName}! Your viewing is <b>tomorrow at ${timeStr}</b> 🏠\n\n📍 <b>${addr}</b>\n🗺 <a href="${mapsLink}">Open in Google Maps</a>\n\nAre you still coming?`,
        { reply_markup: { inline_keyboard: [
          [{ text: "Yes, see you there! ✅", callback_data: 'remind_yes' }],
          [{ text: "I need to cancel ❌", callback_data: 'remind_cancel' }],
        ] } }
      );
      await supabase.from('viewing_bookings').update({ tenant_confirmed_1d: true }).eq('id', booking.id);
    }
  }
}

// ═══════════════════════════════════════════
// CANCELLED SLOT REASSIGNMENT
// ═══════════════════════════════════════════
async function handleCancelledSlotReassignment(supabase: any, token: string, cancelledBookingId: string) {
  const { data: cancelledBooking } = await supabase.from('viewing_bookings')
    .select('*').eq('id', cancelledBookingId).single();
  if (!cancelledBooking) return;

  const { data: candidates } = await supabase.from('applicants')
    .select('*')
    .eq('property_id', cancelledBooking.property_id)
    .eq('stage', 'approved')
    .is('viewing_booked_at', null)
    .order('match_score', { ascending: false })
    .limit(1);

  if (candidates && candidates.length > 0) {
    const next = candidates[0];
    const chatId = next.telegram_chat_id || (next.telegram_user_id ? parseInt(next.telegram_user_id) : null);
    if (chatId) {
      const firstName = (next.full_name || 'there').split(' ')[0];
      const dt = new Date(cancelledBooking.slot_start);
      const label = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) +
        ' at ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      await sendMessage(token, chatId,
        `Hey ${firstName}! A viewing slot just opened up 🎉\n\nWould <b>${label}</b> work for you?`,
        { reply_markup: { inline_keyboard: [
          [{ text: `Yes, book it! ✅`, callback_data: `vslot_reassign_${cancelledBookingId}` }],
          [{ text: "No thanks", callback_data: 'vslot_skip' }],
        ] } }
      );
    }
  }
}

// ═══════════════════════════════════════════
// MATCH SCORING
// ═══════════════════════════════════════════
async function runMatchScoring(supabase: any, applicantId: string) {
  const { data: applicant } = await supabase.from('applicants').select('*').eq('id', applicantId).single();
  if (!applicant) return;
  const { data: property } = await supabase.from('landlord_properties').select('rent_amount').eq('id', applicant.property_id).single();
  if (!property) return;
  const { data: criteria } = await supabase.from('landlord_criteria').select('*').eq('property_id', applicant.property_id).maybeSingle();

  const rent = property.rent_amount || 1000;
  const scrapeData = {
    ...(applicant.scrape_linkedin ? { linkedin: applicant.scrape_linkedin } : {}),
    ...(applicant.scrape_kvk ? { kvk: applicant.scrape_kvk } : {}),
    ...(applicant.scrape_google ? { google: applicant.scrape_google } : {}),
  };
  const result = calculateMatchScore(applicant, criteria, rent, Object.keys(scrapeData).length > 0 ? scrapeData : null);

  await supabase.from('applicants').update({
    match_score: Math.round(result.score * 10),
    match_label: result.label,
    match_flags: result.flags,
    hard_disqualified: result.hardDisqualified,
    hard_disqualify_reason: result.hardDisqualifyReason,
  }).eq('id', applicantId);
}

// ═══════════════════════════════════════════
// AI-POWERED RESPONSE HANDLER
// ═══════════════════════════════════════════
async function handleAIResponse(supabase: any, token: string, chatId: number, applicant: any, userText: string) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  if (!LOVABLE_API_KEY) {
    console.error('[AI] LOVABLE_API_KEY not configured');
    await sendMessage(token, chatId, `Hey ${firstName}! Your application is with the landlord — I'll message you as soon as there's an update. Hang tight! 😊`);
    return;
  }

  try {
    // Check for cancellation intent first (fast path)
    const cancelWords = ['cancel', 'annuleren', 'afzeggen', 'can\'t make it', 'cant make it', 'not coming', 'cancel viewing', 'cancel my viewing'];
    const lowerText = userText.toLowerCase();
    const wantsCancellation = cancelWords.some(w => lowerText.includes(w));

    if (wantsCancellation) {
      // Find active booking
      const { data: booking } = await supabase.from('viewing_bookings')
        .select('*').eq('applicant_id', applicant.id)
        .in('status', ['confirmed', 'pending_landlord'])
        .order('slot_start', { ascending: true })
        .limit(1).maybeSingle();

      if (booking) {
        await sendMessage(token, chatId,
          `Got it ${firstName}, would you like me to cancel your viewing?`,
          { reply_markup: { inline_keyboard: [
            [{ text: "Yes, cancel it ❌", callback_data: 'remind_cancel' }],
            [{ text: "No, keep it ✅", callback_data: 'remind_yes' }],
          ] } }
        );
        return;
      } else {
        await sendMessage(token, chatId, `Hey ${firstName}, I don't see any upcoming viewings to cancel. If you think this is wrong, just let me know! 😊`);
        return;
      }
    }

    // Fetch property info for context
    const { data: property } = await supabase.from('landlord_properties')
      .select('address, city, rent_amount, surface_m2, num_rooms, property_type, accommodation_type, building_year, energy_label, furnished_status, available_date, min_lease_length, postcode')
      .eq('id', applicant.property_id).maybeSingle();

    // Fetch viewing booking info
    const { data: booking } = await supabase.from('viewing_bookings')
      .select('slot_start, slot_end, status')
      .eq('applicant_id', applicant.id)
      .in('status', ['confirmed', 'pending_landlord'])
      .order('slot_start', { ascending: true })
      .limit(1).maybeSingle();

    // Build property context
    let propertyContext = '';
    if (property) {
      const details: string[] = [];
      if (property.address) details.push(`Address: ${property.address}`);
      if (property.city) details.push(`City: ${property.city}`);
      if (property.postcode) details.push(`Postcode: ${property.postcode}`);
      if (property.rent_amount) details.push(`Rent: €${property.rent_amount}/month`);
      if (property.surface_m2) details.push(`Surface: ${property.surface_m2}m²`);
      if (property.num_rooms) details.push(`Rooms: ${property.num_rooms}`);
      if (property.property_type) details.push(`Type: ${property.property_type}`);
      if (property.accommodation_type) details.push(`Accommodation: ${property.accommodation_type}`);
      if (property.building_year) details.push(`Built: ${property.building_year}`);
      if (property.energy_label) details.push(`Energy label: ${property.energy_label}`);
      if (property.furnished_status) details.push(`Furnished: ${property.furnished_status}`);
      if (property.available_date) details.push(`Available from: ${property.available_date}`);
      if (property.min_lease_length) details.push(`Minimum lease: ${property.min_lease_length}`);
      propertyContext = details.join('\n');
    }

    let bookingContext = '';
    if (booking) {
      const dt = new Date(booking.slot_start);
      bookingContext = `\nViewing: ${dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (status: ${booking.status})`;
    }

    const stageContext = applicant.stage === 'screening_complete' ? 'Their screening is complete and under review.'
      : applicant.stage === 'approved' ? 'They have been approved.'
      : applicant.stage === 'viewing_pending' ? 'They have a viewing time pending landlord approval.'
      : applicant.stage === 'viewing_booked' ? 'They have a confirmed viewing.'
      : `Current stage: ${applicant.stage}`;

    const systemPrompt = `You are a friendly, helpful rental assistant for FairKamer. You chat with tenants via Telegram about their rental application.

Your personality:
- Warm, casual, helpful — like texting a friend who works in real estate
- Use the tenant's first name (${firstName})
- Keep responses SHORT (2-4 sentences max) — this is Telegram, not email
- Use emojis sparingly but naturally
- Always be encouraging and supportive

PROPERTY INFO:
${propertyContext || 'No property details available yet.'}
${bookingContext}

TENANT STATUS: ${stageContext}

RULES:
- Answer questions about the property using the info above
- If you don't have info the tenant asks about (e.g. parking, pets policy, specific amenities), say something like "Good question! I don't have that detail handy — I'd suggest asking the landlord directly during the viewing, or I can pass your question along."
- If they want to cancel, ask them to confirm with the cancel button
- If they ask about their application status, use the tenant status above
- NEVER make up property details you don't have
- NEVER discuss other applicants
- Reply in the same language the tenant writes in (Dutch or English)
- Keep it to plain text with minimal HTML — Telegram doesn't render complex HTML well`;

    const response = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[AI] Gateway error:', response.status, await response.text());
      await sendMessage(token, chatId, `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back from the landlord. Hang tight! 😊`);
      return;
    }

    const result = await response.json();
    const aiReply = result.choices?.[0]?.message?.content;

    if (aiReply && aiReply.trim()) {
      await sendMessage(token, chatId, aiReply.trim());
    } else {
      await sendMessage(token, chatId, `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back. Sit tight! 😊`);
    }
  } catch (err) {
    console.error('[AI] Error:', err);
    await sendMessage(token, chatId, `Hey ${firstName}! I'm here if you need anything. Your application is with the landlord — I'll let you know as soon as there's news! 😊`);
  }
}

// ═══════════════════════════════════════════
// TELEGRAM HELPERS
// ═══════════════════════════════════════════
async function sendMessage(token: string, chatId: number, text: string, extra?: any) {
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}
