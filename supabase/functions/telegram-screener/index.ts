import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// ═══════════════════════════════════════════
// TRANSLATIONS
// ═══════════════════════════════════════════
const TRANSLATIONS: Record<string, Record<string, any>> = {
  en: {
    welcome: (firstName: string, landlordName: string, address: string) =>
      `Hey ${firstName}!\n\nI'm helping ${landlordName} find the right tenant for their place at <b>${address}</b>.\n\nI'll ask you a few quick questions — takes about 5 minutes — and it really helps you stand out from other applicants. Ready to go?`,
    start_yes: "Yeah, let's do it!",
    start_info: "Wait, what is this?",
    info_reply: `Good question! FairKamer helps landlords find their ideal tenant — fairly and transparently.\n\nI'll ask you a few things about yourself, and the landlord gets a compatibility score. No weird stuff, no hidden checks. Just honest matching.\n\nWant to give it a go?`,
    lets_go: "Alright, let's go!",
    ask_name: "Awesome! Let's start with the basics — what's your full name?",
    nice_to_meet: (name: string) => `Nice to meet you, ${name}!`,
    occupants_q: (name: string) => `So ${name}, will you be living there on your own or with others?`,
    occ_1: "Just me", occ_2: "2 of us", occ_3: "3 people", occ_4: "4+",
    move_q: "When are you hoping to move in?",
    move_this: "ASAP / this month", move_next: "Next month", move_later: "In 2-3 months", move_flex: "I'm flexible",
    emp_q: "What do you do for work?",
    emp_loon: "Employed (loondienst)", emp_zzp: "Self-employed (ZZP)", emp_student: "Student", emp_uitkering: "Uitkering (benefits)",
    income_q: "Roughly what's your gross monthly income? This stays private.",
    inc_1: "Under \u20AC1,500", inc_2: "\u20AC1,500 \u2013 \u20AC2,500", inc_3: "\u20AC2,500 \u2013 \u20AC3,500", inc_4: "\u20AC3,500 \u2013 \u20AC5,000", inc_5: "\u20AC5,000+",
    lease_q: "How long are you looking to stay?",
    lease_6: "~6 months", lease_12: "About a year", lease_2plus: "2+ years", lease_max: "As long as possible!",
    smoking_q: "Quick one — do you smoke?",
    smoke_no: "Nope", smoke_outside: "Only outside", smoke_yes: "Yes",
    pets_q: "Any pets coming along?",
    pets_none: "No pets", pets_cat: "Cat", pets_dog: "Dog", pets_other: "Other",
    bkr_q: "Last question — any BKR registrations or past rent arrears?",
    bkr_clean: "Nope, all clean", bkr_yes: "Yes, happy to explain",
    consent_msg: (name: string) => `Alright ${name}, almost done! By continuing, you agree that your info may be used to verify your application under Dutch AVG/GDPR rules.\n\nJust type <b>"I agree"</b> and we'll wrap up.`,
    consent_remind: (name: string) => `Just type <b>"I agree"</b> to continue, ${name}.`,
    social_ask: (name: string) => `Thanks ${name}!\n\nOne more optional thing — if you share your Instagram handle, it helps the landlord get a better sense of who you are.\n\nDrop your handle (like @yourname) or skip it.`,
    skip_social: "Skip this",
    done_msg: (name: string) => `You're all done ${name}! Your screening is complete and the landlord will review your profile. If they like what they see, I'll send you available viewing times right here.\n\nThanks for going through the process — fingers crossed!`,
    use_buttons: (name: string) => `Hey ${name}, could you use the buttons above to answer? It helps me keep track.`,
    no_link: (name: string) => `Hey ${name}! You'll need a screening link from your landlord to get started. Ask them for it.`,
    bad_link: (name: string) => `Hmm, that link doesn't seem to work ${name}. Could you double-check with your landlord?`,
  },
  nl: {
    welcome: (firstName: string, landlordName: string, address: string) =>
      `Hoi ${firstName}!\n\nIk help ${landlordName} bij het vinden van de juiste huurder voor het adres <b>${address}</b>.\n\nIk stel je een paar korte vragen — duurt ongeveer 5 minuten — en het helpt je echt om op te vallen. Klaar om te beginnen?`,
    start_yes: "Ja, laten we beginnen!",
    start_info: "Wacht, wat is dit?",
    info_reply: `Goede vraag! FairKamer helpt verhuurders hun ideale huurder te vinden — eerlijk en transparant.\n\nIk stel je een paar vragen over jezelf, en de verhuurder krijgt een compatibiliteitsscore. Geen rare dingen, geen verborgen checks. Gewoon eerlijke matching.\n\nZullen we beginnen?`,
    lets_go: "Oké, laten we gaan!",
    ask_name: "Top! Laten we beginnen — wat is je volledige naam?",
    nice_to_meet: (name: string) => `Leuk je te ontmoeten, ${name}!`,
    occupants_q: (name: string) => `${name}, ga je alleen wonen of met anderen?`,
    occ_1: "Alleen", occ_2: "Met z'n tweeën", occ_3: "3 personen", occ_4: "4+",
    move_q: "Wanneer wil je verhuizen?",
    move_this: "Zo snel mogelijk", move_next: "Volgende maand", move_later: "Over 2-3 maanden", move_flex: "Flexibel",
    emp_q: "Wat doe je voor werk?",
    emp_loon: "In loondienst", emp_zzp: "ZZP'er", emp_student: "Student", emp_uitkering: "Uitkering",
    income_q: "Wat is ongeveer je bruto maandinkomen? Dit blijft privé.",
    inc_1: "Onder \u20AC1.500", inc_2: "\u20AC1.500 \u2013 \u20AC2.500", inc_3: "\u20AC2.500 \u2013 \u20AC3.500", inc_4: "\u20AC3.500 \u2013 \u20AC5.000", inc_5: "\u20AC5.000+",
    lease_q: "Hoe lang wil je blijven?",
    lease_6: "~6 maanden", lease_12: "Ongeveer een jaar", lease_2plus: "2+ jaar", lease_max: "Zo lang mogelijk!",
    smoking_q: "Rook je?",
    smoke_no: "Nee", smoke_outside: "Alleen buiten", smoke_yes: "Ja",
    pets_q: "Neem je huisdieren mee?",
    pets_none: "Geen huisdieren", pets_cat: "Kat", pets_dog: "Hond", pets_other: "Anders",
    bkr_q: "Laatste vraag — heb je BKR-registraties of huurachterstanden?",
    bkr_clean: "Nee, alles schoon", bkr_yes: "Ja, ik kan het uitleggen",
    consent_msg: (name: string) => `Bijna klaar ${name}! Door verder te gaan, ga je ermee akkoord dat je gegevens mogen worden gebruikt om je aanvraag te verifiëren onder de AVG/GDPR.\n\nTyp <b>"Ik ga akkoord"</b> om af te ronden.`,
    consent_remind: (name: string) => `Typ <b>"Ik ga akkoord"</b> om verder te gaan, ${name}.`,
    social_ask: (name: string) => `Bedankt ${name}!\n\nNog een optioneel ding — als je je Instagram-handle deelt, helpt dat de verhuurder om een beter beeld van je te krijgen.\n\nStuur je handle (bijv. @jouwNaam) of sla het over.`,
    skip_social: "Overslaan",
    done_msg: (name: string) => `Je bent klaar ${name}! Je screening is voltooid en de verhuurder zal je profiel bekijken. Als ze enthousiast zijn, stuur ik je hier de beschikbare bezichtigingstijden.\n\nBedankt voor het doorlopen van het proces!`,
    use_buttons: (name: string) => `Hoi ${name}, kun je de knoppen hierboven gebruiken om te antwoorden?`,
    no_link: (name: string) => `Hoi ${name}! Je hebt een screeningslink van je verhuurder nodig. Vraag het hen.`,
    bad_link: (name: string) => `Hmm, die link lijkt niet te werken ${name}. Kun je het dubbelchecken bij je verhuurder?`,
  },
};

function tr(lang: string, key: string, ...args: any[]): string {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const val = t[key] ?? TRANSLATIONS['en'][key] ?? key;
  if (typeof val === 'function') return val(...args);
  return val;
}

// ═══════════════════════════════════════════
// SCREENING QUESTIONS
// ═══════════════════════════════════════════
const SCREENING_QUESTIONS = [
  {
    id: 'occupants', stage: 'q_occupants',
    questionKey: 'occupants_q', questionNeedsName: true,
    options: [
      { textKey: 'occ_1', callback: 'occ_1' },
      { textKey: 'occ_2', callback: 'occ_2' },
      { textKey: 'occ_3', callback: 'occ_3' },
      { textKey: 'occ_4', callback: 'occ_4' },
    ],
    dbField: 'num_occupants',
    valueMap: { occ_1: 'Just me', occ_2: '2 people', occ_3: '3 people', occ_4: '4+' },
    nextStage: 'q_move_in',
  },
  {
    id: 'move_in_date', stage: 'q_move_in',
    questionKey: 'move_q', questionNeedsName: false,
    options: [
      { textKey: 'move_this', callback: 'move_this' },
      { textKey: 'move_next', callback: 'move_next' },
      { textKey: 'move_later', callback: 'move_later' },
      { textKey: 'move_flex', callback: 'move_flex' },
    ],
    dbField: 'desired_move_in',
    valueMap: { move_this: 'This month', move_next: 'Next month', move_later: 'In 2-3 months', move_flex: 'Flexible' },
    nextStage: 'q_employment',
  },
  {
    id: 'employment', stage: 'q_employment',
    questionKey: 'emp_q', questionNeedsName: false,
    options: [
      { textKey: 'emp_loon', callback: 'emp_loon' },
      { textKey: 'emp_zzp', callback: 'emp_zzp' },
      { textKey: 'emp_student', callback: 'emp_student' },
      { textKey: 'emp_uitkering', callback: 'emp_uitkering' },
    ],
    dbField: 'employment_type',
    valueMap: { emp_loon: 'Loondienst (employed)', emp_zzp: 'ZZP (self-employed)', emp_student: 'Student', emp_uitkering: 'Uitkering (benefits)' },
    nextStage: 'q_income',
  },
  {
    id: 'income', stage: 'q_income',
    questionKey: 'income_q', questionNeedsName: false,
    options: [
      { textKey: 'inc_1', callback: 'inc_1' },
      { textKey: 'inc_2', callback: 'inc_2' },
      { textKey: 'inc_3', callback: 'inc_3' },
      { textKey: 'inc_4', callback: 'inc_4' },
      { textKey: 'inc_5', callback: 'inc_5' },
    ],
    dbField: 'monthly_income',
    valueMap: { inc_1: 1250, inc_2: 2000, inc_3: 3000, inc_4: 4250, inc_5: 5500 },
    incomeRange: { inc_1: 'Under \u20AC1,500', inc_2: '\u20AC1,500 - \u20AC2,500', inc_3: '\u20AC2,500 - \u20AC3,500', inc_4: '\u20AC3,500 - \u20AC5,000', inc_5: '\u20AC5,000+' },
    nextStage: 'q_lease',
  },
  {
    id: 'lease_length', stage: 'q_lease',
    questionKey: 'lease_q', questionNeedsName: false,
    options: [
      { textKey: 'lease_6', callback: 'lease_6' },
      { textKey: 'lease_12', callback: 'lease_12' },
      { textKey: 'lease_2plus', callback: 'lease_2plus' },
      { textKey: 'lease_max', callback: 'lease_max' },
    ],
    dbField: 'desired_lease_length',
    valueMap: { lease_6: '6 months', lease_12: '12 months', lease_2plus: '2+ years', lease_max: 'As long as possible' },
    nextStage: 'q_smoking',
  },
  {
    id: 'smoking', stage: 'q_smoking',
    questionKey: 'smoking_q', questionNeedsName: false,
    options: [
      { textKey: 'smoke_no', callback: 'smoke_no' },
      { textKey: 'smoke_outside', callback: 'smoke_outside' },
      { textKey: 'smoke_yes', callback: 'smoke_yes' },
    ],
    dbField: 'lifestyle_answers', lifestyleKey: 'smoking',
    valueMap: { smoke_no: 'No', smoke_outside: 'Outside only', smoke_yes: 'Yes' },
    nextStage: 'q_pets',
  },
  {
    id: 'pets', stage: 'q_pets',
    questionKey: 'pets_q', questionNeedsName: false,
    options: [
      { textKey: 'pets_none', callback: 'pets_none' },
      { textKey: 'pets_cat', callback: 'pets_cat' },
      { textKey: 'pets_dog', callback: 'pets_dog' },
      { textKey: 'pets_other', callback: 'pets_other' },
    ],
    dbField: 'lifestyle_answers', lifestyleKey: 'pets',
    valueMap: { pets_none: 'No pets', pets_cat: 'Cat', pets_dog: 'Dog', pets_other: 'Other' },
    nextStage: 'q_bkr',
  },
  {
    id: 'bkr', stage: 'q_bkr',
    questionKey: 'bkr_q', questionNeedsName: false,
    options: [
      { textKey: 'bkr_clean', callback: 'bkr_clean' },
      { textKey: 'bkr_yes', callback: 'bkr_yes' },
    ],
    dbField: 'bkr_status',
    valueMap: { bkr_clean: 'No, clean record', bkr_yes: 'Yes, I can explain' },
    nextStage: 'consent',
  },
];

// ═══════════════════════════════════════════
// MATCH SCORE
// ═══════════════════════════════════════════
function getIncomeEstimate(range: string | null): number {
  switch (range) {
    case 'Under \u20AC1,500': return 1250;
    case '\u20AC1,500 - \u20AC2,500': return 2000;
    case '\u20AC2,500 - \u20AC3,500': return 3000;
    case '\u20AC3,500 - \u20AC5,000': return 4250;
    case '\u20AC5,000+': return 5500;
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
// SLOT GENERATION
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
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ error: 'Applicant not found' }), { status: 404 });

      const chatId = appData.telegram_chat_id || (appData.telegram_user_id ? parseInt(appData.telegram_user_id) : null);
      if (!chatId) return new Response(JSON.stringify({ error: 'No chat ID' }), { status: 400 });

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const { data: propData } = await supabase.from('landlord_properties').select('address').eq('id', property_id).single();
      const address = propData?.address || 'the property';

      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlord_id);
      if (!schedule || schedule.length === 0) {
        await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! The landlord loved your profile and wants to meet you. They're setting up viewing times right now — I'll send you the options as soon as they're ready.`);
        return new Response(JSON.stringify({ ok: true }));
      }

      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlord_id);
      const slots = generateAvailableSlots(schedule, bookings || []);

      if (slots.length === 0) {
        await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! The landlord loved your application. All viewing times are full right now, but I'll message you the moment a slot opens up.`);
        return new Response(JSON.stringify({ ok: true }));
      }

      const displaySlots = slots.slice(0, 6);
      const buttons = displaySlots.map((slot, i) => [{ text: slot.label, callback_data: `vslot_${i}` }]);
      await supabase.from('applicants').update({ pending_viewing_slots: JSON.stringify(displaySlots) }).eq('id', applicant_id);

      const msg = displaySlots.length === 1
        ? `Hey ${firstName}! Great news — the landlord would love to show you the place at <b>${address}</b>.\n\nHow does <b>${displaySlots[0].label}</b> work for you?`
        : `Hey ${firstName}! Great news — the landlord would love to show you the place at <b>${address}</b>.\n\nWould <b>${displaySlots[0].label}</b> work for you? If not, I've got a few other times below.`;
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
        `Hi ${firstName},\n\nThanks so much for taking the time to apply for <b>${address}</b>. The landlord has decided to go in a different direction this time.\n\nI know it's not the news you were hoping for, but don't give up — the right place is out there. Good luck with your search.`
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
        `It's official, ${firstName}!\n\nYour viewing is confirmed:\n\n<b>${dateStr} at ${timeStr}</b>\n<b>${address}</b>\n<a href="${mapsLink}">Open in Google Maps</a>\n\nI'll send you a reminder the day before. See you there!`
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_reminders') {
      await handleReminders(supabase, BOT_TOKEN);
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'offer_cancelled_slot') {
      await handleCancelledSlotReassignment(supabase, BOT_TOKEN, body.booking_id);
      return new Response(JSON.stringify({ ok: true }));
    }

    // ═══════════════════════════════════════════
    // TELEGRAM WEBHOOK UPDATES
    // ═══════════════════════════════════════════
    const update = body;

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
    const firstName = message.from?.first_name || 'there';

    const { data: applicant } = await supabase
      .from('applicants').select('*').eq('telegram_user_id', telegramUserId).maybeSingle();

    if (!applicant) {
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const propertyId = parts[1];
        if (!propertyId) {
          await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! You'll need a screening link from your landlord to get started. Ask them for it.`);
          return new Response('OK');
        }
        const { data: property } = await supabase
          .from('landlord_properties').select('id, address, landlord_id').eq('id', propertyId).maybeSingle();
        if (!property) {
          await sendMessage(BOT_TOKEN, chatId, `Hmm, that link doesn't seem to work ${firstName}. Could you double-check with your landlord?`);
          return new Response('OK');
        }

        // Create applicant and ask for language
        await supabase.from('applicants').insert({
          telegram_user_id: telegramUserId,
          telegram_chat_id: chatId,
          property_id: propertyId,
          stage: 'lang_select',
          preferred_language: 'en',
        });

        await sendMessage(BOT_TOKEN, chatId,
          `Hey ${firstName}! Before we begin, which language do you prefer?\n\nHoi ${firstName}! In welke taal wil je verdergaan?`,
          { reply_markup: { inline_keyboard: [
            [{ text: "English", callback_data: 'lang_en' }],
            [{ text: "Nederlands", callback_data: 'lang_nl' }],
            [{ text: "Other / Anders", callback_data: 'lang_other' }],
          ] } }
        );
      } else {
        await sendMessage(BOT_TOKEN, chatId, `Hey ${firstName}! You'll need a screening link from your landlord to get started. Ask them for it.`);
      }
      return new Response('OK');
    }

    // Update chat_id if missing
    if (!applicant.telegram_chat_id) {
      await supabase.from('applicants').update({ telegram_chat_id: chatId }).eq('id', applicant.id);
    }

    // Handle language typing for "other"
    if (applicant.stage === 'lang_other_input') {
      // They typed their language — store it and use English as fallback, proceed
      await supabase.from('applicants').update({ preferred_language: text.toLowerCase(), stage: 'welcome' }).eq('id', applicant.id);
      // Continue with welcome in English as fallback
      const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
      const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
      const landlordName = landlord?.full_name?.split(' ')[0] || 'your landlord';
      await sendMessage(BOT_TOKEN, chatId,
        tr('en', 'welcome', firstName, landlordName, property?.address || 'the property'),
        { reply_markup: { inline_keyboard: [[
          { text: tr('en', 'start_yes'), callback_data: 'start_yes' },
          { text: tr('en', 'start_info'), callback_data: 'start_info' },
        ]] } }
      );
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
  const firstName = (applicant.full_name || applicant.telegram_user_id || 'there').split(' ')[0];
  const lang = applicant.preferred_language || 'en';
  const useLang = (lang === 'en' || lang === 'nl') ? lang : 'en';

  // Language selection
  if (data === 'lang_en' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ preferred_language: 'en', stage: 'welcome' }).eq('id', applicant.id);
    const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
    const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
    const landlordName = landlord?.full_name?.split(' ')[0] || 'your landlord';
    const tgFirstName = firstName !== 'there' ? firstName : 'there';
    await sendMessage(token, chatId,
      tr('en', 'welcome', tgFirstName, landlordName, property?.address || 'the property'),
      { reply_markup: { inline_keyboard: [[
        { text: tr('en', 'start_yes'), callback_data: 'start_yes' },
        { text: tr('en', 'start_info'), callback_data: 'start_info' },
      ]] } }
    );
    return;
  }
  if (data === 'lang_nl' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ preferred_language: 'nl', stage: 'welcome' }).eq('id', applicant.id);
    const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
    const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
    const landlordName = landlord?.full_name?.split(' ')[0] || 'je verhuurder';
    const tgFirstName = firstName !== 'there' ? firstName : 'daar';
    await sendMessage(token, chatId,
      tr('nl', 'welcome', tgFirstName, landlordName, property?.address || 'de woning'),
      { reply_markup: { inline_keyboard: [[
        { text: tr('nl', 'start_yes'), callback_data: 'start_yes' },
        { text: tr('nl', 'start_info'), callback_data: 'start_info' },
      ]] } }
    );
    return;
  }
  if (data === 'lang_other' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ stage: 'lang_other_input' }).eq('id', applicant.id);
    await sendMessage(token, chatId, `Please type your preferred language (e.g. "Spanish", "German", "Arabic").\n\nNote: we'll do our best, but the screening will continue in English.`);
    return;
  }

  if (data === 'start_yes') {
    await supabase.from('applicants').update({ stage: 'name' }).eq('id', applicant.id);
    await sendMessage(token, chatId, tr(useLang, 'ask_name'));
    return;
  }
  if (data === 'start_info') {
    await sendMessage(token, chatId,
      tr(useLang, 'info_reply'),
      { reply_markup: { inline_keyboard: [[ { text: tr(useLang, 'lets_go'), callback_data: 'start_yes' } ]] } }
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

      const nextQ = SCREENING_QUESTIONS.find(nq => nq.stage === q.nextStage);
      if (nextQ) {
        const question = nextQ.questionNeedsName ? tr(useLang, nextQ.questionKey, firstName) : tr(useLang, nextQ.questionKey);
        await sendMessage(token, chatId, question, {
          reply_markup: { inline_keyboard: nextQ.options.map(o => [{ text: tr(useLang, o.textKey), callback_data: o.callback }]) }
        });
      } else if (q.nextStage === 'consent') {
        await sendMessage(token, chatId, tr(useLang, 'consent_msg', firstName));
      }
      return;
    }
  }

  // Skip social
  if (data === 'skip_social') {
    await supabase.from('applicants').update({ stage: 'screening_complete' }).eq('id', applicant.id);
    await runMatchScoring(supabase, applicant.id);
    await sendMessage(token, chatId, tr(useLang, 'done_msg', firstName));
    return;
  }

  // Viewing slot selection
  if (data.startsWith('vslot_')) {
    const slotIndex = parseInt(data.replace('vslot_', ''));
    let availableSlots: any[] = [];
    try { availableSlots = JSON.parse(applicant.pending_viewing_slots || '[]'); } catch {}
    const selectedSlot = availableSlots[slotIndex];
    if (!selectedSlot) {
      await sendMessage(token, chatId, `Hmm, that time doesn't seem available anymore ${firstName}. The landlord will send you fresh options soon.`);
      return;
    }

    const { data: property } = await supabase.from('landlord_properties').select('landlord_id, address').eq('id', applicant.property_id).single();
    if (!property) return;

    const { data: existingBooking } = await supabase.from('viewing_bookings')
      .select('id')
      .eq('landlord_id', property.landlord_id)
      .eq('slot_start', selectedSlot.start)
      .not('status', 'in', '("cancelled_tenant","cancelled_landlord")')
      .maybeSingle();

    if (existingBooking) {
      await sendMessage(token, chatId, `Oh no, someone just grabbed that slot. Let me check what else is available...`);
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', property.landlord_id);
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', property.landlord_id);
      const freshSlots = generateAvailableSlots(schedule || [], bookings || []);
      if (freshSlots.length > 0) {
        const display = freshSlots.slice(0, 6);
        await supabase.from('applicants').update({ pending_viewing_slots: JSON.stringify(display) }).eq('id', applicant.id);
        const buttons = display.map((s, i) => [{ text: s.label, callback_data: `vslot_${i}` }]);
        await sendMessage(token, chatId, `Here are the available times — pick one that works for you:`, { reply_markup: { inline_keyboard: buttons } });
      } else {
        await sendMessage(token, chatId, `All slots are taken right now. I'll message you when new ones open up.`);
      }
      return;
    }

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
      await sendMessage(token, chatId, `Something went wrong booking that slot. The landlord will send new times shortly.`);
      return;
    }

    await supabase.from('applicants').update({
      viewing_booked_at: selectedSlot.start,
      stage: 'viewing_pending',
      pending_viewing_slots: null,
    }).eq('id', applicant.id);

    await supabase.from('notifications').insert({
      landlord_id: property.landlord_id,
      type: 'booking_request',
      title: `${firstName} picked a viewing time`,
      message: `${applicant.full_name || firstName} wants to view ${property.address} on ${selectedSlot.label}. Check the Applicants tab to confirm or decline.`,
      related_applicant_id: applicant.id,
    });

    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`;
    await sendMessage(token, chatId,
      `Nice choice, ${firstName}!\n\nYou picked <b>${selectedSlot.label}</b> at <b>${property.address}</b>.\n\n<a href="${mapsLink}">Open in Google Maps</a>\n\nI've sent this to the landlord for approval — you'll get a confirmation as soon as they say yes. Hang tight.`
    );
    await runMatchScoring(supabase, applicant.id);
    return;
  }

  // Reminder: tenant confirms
  if (data === 'remind_yes') {
    // Mark 24h response
    const { data: bk } = await supabase.from('viewing_bookings')
      .select('id, slot_start, property_id')
      .eq('applicant_id', applicant.id)
      .eq('status', 'confirmed')
      .order('slot_start', { ascending: true })
      .limit(1).maybeSingle();
    if (bk) {
      await supabase.from('viewing_bookings').update({ reminder_24h_response: 'yes' }).eq('id', bk.id);
      const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', bk.property_id).single();
      const dt = new Date(bk.slot_start);
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      await sendMessage(token, chatId, `Perfect, see you tomorrow at ${timeStr}. The address is ${prop?.address || 'the property'}. Good luck!`);
    } else {
      await sendMessage(token, chatId, `Great, see you there ${firstName}!`);
    }
    return;
  }

  // Reminder: tenant cancels — trigger cascade
  if (data === 'remind_cancel') {
    const { data: booking } = await supabase.from('viewing_bookings')
      .select('*').eq('applicant_id', applicant.id)
      .in('status', ['confirmed', 'pending_landlord'])
      .order('slot_start', { ascending: true })
      .limit(1).maybeSingle();

    if (booking) {
      // Apply cancellation penalty
      const cancCount = (applicant.cancellation_count || 0) + 1;
      const newScore = Math.max(0, (applicant.match_score || 0) - 5);
      const flags = applicant.match_flags || [];
      const totalIssues = cancCount + (applicant.no_response_count || 0);
      if (totalIssues >= 2 && !flags.includes('Reliability warning: multiple cancellations or no-shows')) {
        flags.push('Reliability warning: multiple cancellations or no-shows');
      }
      await supabase.from('applicants').update({
        cancellation_count: cancCount,
        match_score: newScore,
        match_flags: flags,
      }).eq('id', applicant.id);

      // Determine if this is a late cancel (2h) — use 5 min timeout, else 10 min
      const hoursUntil = (new Date(booking.slot_start).getTime() - Date.now()) / 3600_000;
      const timeoutMin = hoursUntil <= 3 ? 5 : 10;

      await supabase.from('viewing_bookings').update({
        status: 'cancelled_tenant',
        cancelled_at: new Date().toISOString(),
        reminder_24h_response: 'no',
      }).eq('id', booking.id);

      await supabase.from('notifications').insert({
        landlord_id: booking.landlord_id,
        type: 'cancellation',
        title: `${applicant.full_name || firstName} cancelled their viewing`,
        message: `${applicant.full_name || firstName} cancelled their viewing. Looking for a replacement from the applicant list.`,
        related_booking_id: booking.id,
        related_applicant_id: applicant.id,
      });

      await sendMessage(token, chatId, `No problem ${firstName}, your viewing has been cancelled. I hope you find a great place.`);

      // Trigger cascade
      await triggerCascade(supabase, token, booking, timeoutMin);
    }
    return;
  }

  // Cascade: candidate claims slot
  if (data.startsWith('cascade_yes_')) {
    const bookingId = data.replace('cascade_yes_', '');
    const { data: booking } = await supabase.from('viewing_bookings').select('*').eq('id', bookingId).single();
    if (!booking || booking.cascade_state !== 'active') {
      await sendMessage(token, chatId, `Sorry ${firstName}, that slot has already been taken.`);
      return;
    }

    const cascadeData = booking.cascade_data || {};
    const candidates = cascadeData.candidates || [];

    // Check if someone already claimed it
    const alreadyClaimed = candidates.some((c: any) => c.response === 'yes');
    if (alreadyClaimed) {
      await sendMessage(token, chatId, `Sorry ${firstName}, someone else just claimed that slot. We will keep you posted on future viewings.`);
      return;
    }

    // Mark this candidate as winner
    const updatedCandidates = candidates.map((c: any) =>
      c.applicant_id === applicant.id ? { ...c, response: 'yes' } : c
    );

    // Create new booking for this applicant
    await supabase.from('viewing_bookings').insert({
      landlord_id: booking.landlord_id,
      property_id: booking.property_id,
      applicant_id: applicant.id,
      slot_start: booking.slot_start,
      slot_end: booking.slot_end,
      status: 'confirmed',
    });

    await supabase.from('applicants').update({
      viewing_booked_at: booking.slot_start,
      stage: 'viewing_booked',
    }).eq('id', applicant.id);

    await supabase.from('viewing_bookings').update({
      cascade_state: 'filled',
      cascade_data: { ...cascadeData, candidates: updatedCandidates, winner_id: applicant.id },
    }).eq('id', bookingId);

    const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
    const addr = prop?.address || 'the property';
    const dt = new Date(booking.slot_start);
    const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

    await sendMessage(token, chatId,
      `You got it ${firstName}! Your viewing is confirmed:\n\n<b>${dateStr} at ${timeStr}</b>\n<b>${addr}</b>\n<a href="${mapsLink}">Open in Google Maps</a>\n\nI will send you a reminder beforehand.`
    );

    // Notify other candidates
    for (const c of updatedCandidates) {
      if (c.applicant_id !== applicant.id && c.chat_id && c.response !== 'no') {
        await sendMessage(token, c.chat_id,
          `Thanks, the slot has just been filled. We will keep you posted on future viewings.`
        );
      }
    }

    // Notify landlord
    await supabase.from('notifications').insert({
      landlord_id: booking.landlord_id,
      type: 'cascade_filled',
      title: `Viewing slot filled by ${applicant.full_name || firstName}`,
      message: `${applicant.full_name || firstName} claimed the cancelled viewing slot on ${dateStr} at ${timeStr} for ${addr}.`,
      related_applicant_id: applicant.id,
      related_booking_id: bookingId,
    });
    return;
  }

  // Cascade: candidate declines
  if (data.startsWith('cascade_no_')) {
    const bookingId = data.replace('cascade_no_', '');
    const { data: booking } = await supabase.from('viewing_bookings').select('*').eq('id', bookingId).single();
    if (booking && booking.cascade_state === 'active') {
      const cascadeData = booking.cascade_data || {};
      const updatedCandidates = (cascadeData.candidates || []).map((c: any) =>
        c.applicant_id === applicant.id ? { ...c, response: 'no' } : c
      );
      await supabase.from('viewing_bookings').update({
        cascade_data: { ...cascadeData, candidates: updatedCandidates },
      }).eq('id', bookingId);

      // Check if all have responded NO
      const allDeclined = updatedCandidates.every((c: any) => c.response === 'no');
      if (allDeclined) {
        // Notify landlord immediately
        await supabase.from('viewing_bookings').update({ cascade_state: 'landlord_notified' }).eq('id', bookingId);
        const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
        const dt = new Date(booking.slot_start);
        const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
        const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        await supabase.from('notifications').insert({
          landlord_id: booking.landlord_id,
          type: 'cancellation_no_replacement',
          title: `Viewing cancelled — no replacement found`,
          message: `Your viewing on ${dateStr} at ${timeStr} for ${prop?.address || 'the property'} was cancelled and no replacement was found.`,
          related_booking_id: bookingId,
        });
      }
    }
    await sendMessage(token, chatId, `No worries ${firstName}. We will let you know about future viewing opportunities.`);
    return;
  }
}

// ═══════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════
async function handleTextMessage(supabase: any, token: string, chatId: number, applicant: any, text: string) {
  const stage = applicant.stage;
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const lang = applicant.preferred_language || 'en';
  const useLang = (lang === 'en' || lang === 'nl') ? lang : 'en';

  if (stage === 'name') {
    const name = text.trim();
    const first = name.split(' ')[0];
    await supabase.from('applicants').update({ full_name: name, stage: 'q_occupants' }).eq('id', applicant.id);
    const firstQ = SCREENING_QUESTIONS[0];
    const question = tr(useLang, firstQ.questionKey, first);
    await sendMessage(token, chatId, `${tr(useLang, 'nice_to_meet', first)}\n\n${question}`, {
      reply_markup: { inline_keyboard: firstQ.options.map(o => [{ text: tr(useLang, o.textKey), callback_data: o.callback }]) }
    });
    return;
  }

  if (stage === 'consent') {
    if (text.toLowerCase().includes('agree') || text.toLowerCase().includes('akkoord')) {
      await supabase.from('applicants').update({ consent_given: true, stage: 'socials' }).eq('id', applicant.id);
      await sendMessage(token, chatId,
        tr(useLang, 'social_ask', firstName),
        { reply_markup: { inline_keyboard: [[ { text: tr(useLang, 'skip_social'), callback_data: 'skip_social' } ]] } }
      );
    } else {
      await sendMessage(token, chatId, tr(useLang, 'consent_remind', firstName));
    }
    return;
  }

  if (stage === 'socials') {
    const handle = text.replace('@', '').trim();
    await supabase.from('applicants').update({ social_handle: handle, stage: 'screening_complete' }).eq('id', applicant.id);
    await runMatchScoring(supabase, applicant.id);
    await sendMessage(token, chatId, tr(useLang, 'done_msg', firstName));
    return;
  }

  if (stage === 'done' || stage === 'screening_complete' || stage === 'viewing_pending' || stage === 'approved' || stage === 'viewing_booked') {
    await handleAIResponse(supabase, token, chatId, applicant, text);
    return;
  }

  if (stage?.startsWith('q_')) {
    await sendMessage(token, chatId, tr(useLang, 'use_buttons', firstName));
    return;
  }

  await handleAIResponse(supabase, token, chatId, applicant, text);
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
        `Hey ${firstName}! Just a heads up — your viewing is coming up in 3 days.\n\n<b>${dateStr} at ${timeStr}</b>\n<b>${addr}</b>\n<a href="${mapsLink}">Open in Google Maps</a>\n\nStill good to go?`,
        { reply_markup: { inline_keyboard: [
          [{ text: "Yes, I'll be there!", callback_data: 'remind_yes' }],
          [{ text: "I need to cancel", callback_data: 'remind_cancel' }],
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
        `Hey ${firstName}! Your viewing is <b>tomorrow at ${timeStr}</b>.\n\n<b>${addr}</b>\n<a href="${mapsLink}">Open in Google Maps</a>\n\nAre you still coming?`,
        { reply_markup: { inline_keyboard: [
          [{ text: "Yes, see you there!", callback_data: 'remind_yes' }],
          [{ text: "I need to cancel", callback_data: 'remind_cancel' }],
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
        `Hey ${firstName}! A viewing slot just opened up.\n\nWould <b>${label}</b> work for you?`,
        { reply_markup: { inline_keyboard: [
          [{ text: "Yes, book it!", callback_data: `vslot_reassign_${cancelledBookingId}` }],
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
    await sendMessage(token, chatId, `Hey ${firstName}! Your application is with the landlord — I'll message you as soon as there's an update. Hang tight.`);
    return;
  }

  try {
    const cancelWords = ['cancel', 'annuleren', 'afzeggen', "can't make it", 'cant make it', 'not coming', 'cancel viewing', 'cancel my viewing'];
    const lowerText = userText.toLowerCase();
    const wantsCancellation = cancelWords.some(w => lowerText.includes(w));

    if (wantsCancellation) {
      const { data: booking } = await supabase.from('viewing_bookings')
        .select('*').eq('applicant_id', applicant.id)
        .in('status', ['confirmed', 'pending_landlord'])
        .order('slot_start', { ascending: true })
        .limit(1).maybeSingle();

      if (booking) {
        await sendMessage(token, chatId,
          `Got it ${firstName}, would you like me to cancel your viewing?`,
          { reply_markup: { inline_keyboard: [
            [{ text: "Yes, cancel it", callback_data: 'remind_cancel' }],
            [{ text: "No, keep it", callback_data: 'remind_yes' }],
          ] } }
        );
        return;
      } else {
        await sendMessage(token, chatId, `Hey ${firstName}, I don't see any upcoming viewings to cancel. If you think this is wrong, just let me know.`);
        return;
      }
    }

    const { data: property } = await supabase.from('landlord_properties')
      .select('address, city, rent_amount, surface_m2, num_rooms, property_type, accommodation_type, building_year, energy_label, furnished_status, available_date, min_lease_length, postcode')
      .eq('id', applicant.property_id).maybeSingle();

    const { data: booking } = await supabase.from('viewing_bookings')
      .select('slot_start, slot_end, status')
      .eq('applicant_id', applicant.id)
      .in('status', ['confirmed', 'pending_landlord'])
      .order('slot_start', { ascending: true })
      .limit(1).maybeSingle();

    let propertyContext = '';
    if (property) {
      const details: string[] = [];
      if (property.address) details.push(`Address: ${property.address}`);
      if (property.city) details.push(`City: ${property.city}`);
      if (property.postcode) details.push(`Postcode: ${property.postcode}`);
      if (property.rent_amount) details.push(`Rent: \u20AC${property.rent_amount}/month`);
      if (property.surface_m2) details.push(`Surface: ${property.surface_m2}m\u00B2`);
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

    const prefLang = applicant.preferred_language || 'en';
    const langInstruction = prefLang === 'nl'
      ? 'Reply in Dutch (Nederlands).'
      : prefLang !== 'en'
      ? `The tenant prefers ${prefLang}. Reply in that language if you can, otherwise English.`
      : 'Reply in the same language the tenant writes in (Dutch or English).';

    const systemPrompt = `You are a friendly, helpful rental assistant for FairKamer. You chat with tenants via Telegram about their rental application.

Your personality:
- Warm, casual, helpful — like texting a friend who works in real estate
- Use the tenant's first name (${firstName})
- Keep responses SHORT (2-4 sentences max) — this is Telegram, not email
- Do NOT use emojis at all. Keep it professional and clean.
- Always be encouraging and supportive

PROPERTY INFO:
${propertyContext || 'No property details available yet.'}
${bookingContext}

TENANT STATUS: ${stageContext}

LANGUAGE: ${langInstruction}

RULES:
- Answer questions about the property using the info above
- If you don't have info the tenant asks about, say something like "Good question! I don't have that detail handy — I'd suggest asking the landlord directly during the viewing."
- If they want to cancel, ask them to confirm with the cancel button
- If they ask about their application status, use the tenant status above
- NEVER make up property details you don't have
- NEVER discuss other applicants
- Keep it to plain text with minimal HTML`;

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
      await sendMessage(token, chatId, `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back from the landlord. Hang tight.`);
      return;
    }

    const result = await response.json();
    const aiReply = result.choices?.[0]?.message?.content;

    if (aiReply && aiReply.trim()) {
      await sendMessage(token, chatId, aiReply.trim());
    } else {
      await sendMessage(token, chatId, `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back. Sit tight.`);
    }
  } catch (err) {
    console.error('[AI] Error:', err);
    await sendMessage(token, chatId, `Hey ${firstName}! I'm here if you need anything. Your application is with the landlord — I'll let you know as soon as there's news.`);
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
