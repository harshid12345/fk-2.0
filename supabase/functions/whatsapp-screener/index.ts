import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// WhatsApp Cloud API base URL and AI gateway — same gateway as Telegram screener
const WA_API = 'https://graph.facebook.com/v19.0';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const VERIFY_TOKEN = 'fairkamer2026';

// ═══════════════════════════════════════════
// WHATSAPP HELPERS
// Differences from Telegram:
//   - No HTML in message bodies — use stripHtml()
//   - Button title max 20 chars, list row title max 24 chars
//   - ≤3 options → interactive button message
//   - ≥4 options → interactive list message
//   - "from" field is the phone number string (e.g. "31612345678")
//   - No separate chat_id — phone number IS the recipient address
// ═══════════════════════════════════════════

function stripHtml(text: string): string {
  return text
    .replace(/<b>(.*?)<\/b>/gi, '*$1*')   // bold → WhatsApp bold (*text*)
    .replace(/<[^>]+>/g, '')              // remove remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function trunc(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

async function sendText(phoneNumberId: string, token: string, to: string, text: string) {
  const body = stripHtml(text);
  await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.substring(0, 4096) },
    }),
  });
}

async function sendButtons(phoneNumberId: string, token: string, to: string, bodyText: string, buttons: { id: string; title: string }[]) {
  await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: stripHtml(bodyText).substring(0, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: trunc(b.title, 20) },
          })),
        },
      },
    }),
  });
}

async function sendList(phoneNumberId: string, token: string, to: string, bodyText: string, rows: { id: string; title: string }[], buttonLabel = 'Choose') {
  await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: stripHtml(bodyText).substring(0, 1024) },
        action: {
          button: trunc(buttonLabel, 20),
          sections: [{
            title: 'Options',
            rows: rows.slice(0, 10).map(r => ({
              id: r.id,
              title: trunc(r.title, 24),
            })),
          }],
        },
      },
    }),
  });
}

// Unified send: picks text, buttons, or list based on options count
async function sendWA(phoneNumberId: string, token: string, to: string, text: string, options?: { id: string; title: string }[]) {
  if (!options || options.length === 0) {
    await sendText(phoneNumberId, token, to, text);
  } else if (options.length <= 3) {
    await sendButtons(phoneNumberId, token, to, text, options);
  } else {
    await sendList(phoneNumberId, token, to, text, options);
  }
}

// ═══════════════════════════════════════════
// TRANSLATIONS — identical to telegram-screener
// ═══════════════════════════════════════════
const TRANSLATIONS: Record<string, Record<string, any>> = {
  en: {
    welcome: (firstName: string, landlordName: string, address: string) =>
      `Hey ${firstName}!\n\nI'm helping ${landlordName} find the right tenant for their place at *${address}*.\n\nI'll ask you a few quick questions — takes about 5 minutes — and it really helps you stand out from other applicants. Ready to go?`,
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
    emp_loon: "Employed", emp_zzp: "Self-employed (ZZP)", emp_student: "Student", emp_uitkering: "Benefits",
    income_q: "Roughly what's your gross monthly income? This stays private.",
    inc_1: "Under \u20AC1,500", inc_2: "\u20AC1,500-\u20AC2,500", inc_3: "\u20AC2,500-\u20AC3,500", inc_4: "\u20AC3,500-\u20AC5,000", inc_5: "\u20AC5,000+",
    lease_q: "How long are you looking to stay?",
    lease_6: "~6 months", lease_12: "About a year", lease_2plus: "2+ years", lease_max: "As long as possible",
    smoking_q: "Quick one — do you smoke?",
    smoke_no: "No", smoke_outside: "Only outside", smoke_yes: "Yes",
    pets_q: "Any pets coming along?",
    pets_none: "No pets", pets_cat: "Cat", pets_dog: "Dog", pets_other: "Other",
    bkr_q: "Last question — do you have any unpaid debts or past issues paying rent on time?",
    bkr_clean: "No, all good", bkr_yes: "Yes, I can explain",
    consent_msg: (name: string) => `Alright ${name}, almost done! By continuing, you agree that your info may be used to verify your application under Dutch AVG/GDPR rules.\n\nJust type *"I agree"* and we'll wrap up.`,
    consent_remind: (name: string) => `Just type *"I agree"* to continue, ${name}.`,
    social_ask: (name: string) => `Thanks ${name}!\n\nOne last optional step — paste a link to your *LinkedIn*, *Instagram*, or *Facebook* profile. It helps the landlord get a sense of who you are.\n\nJust paste the full URL, or tap Skip.`,
    skip_social: "Skip this",
    done_msg: (name: string) => `You're all done ${name}! Your screening is complete and the landlord will review your profile. If they like what they see, I'll send you available viewing times right here.\n\nThanks for going through the process — fingers crossed!`,
    use_buttons: (name: string) => `Hey ${name}, could you use the buttons above to answer? It helps me keep track.`,
    no_link: (name: string) => `Hey ${name}! You'll need a screening link from your landlord to get started. Ask them for it.`,
    bad_link: (name: string) => `Hmm, that link doesn't seem to work ${name}. Could you double-check with your landlord?`,
  },
  nl: {
    welcome: (firstName: string, landlordName: string, address: string) =>
      `Hoi ${firstName}!\n\nIk help ${landlordName} bij het vinden van de juiste huurder voor het adres *${address}*.\n\nIk stel je een paar korte vragen — duurt ongeveer 5 minuten — en het helpt je echt om op te vallen. Klaar?`,
    start_yes: "Ja, beginnen!",
    start_info: "Wat is dit?",
    info_reply: `Goede vraag! FairKamer helpt verhuurders hun ideale huurder te vinden — eerlijk en transparant.\n\nIk stel je een paar vragen over jezelf, en de verhuurder krijgt een compatibiliteitsscore. Geen rare dingen, geen verborgen checks. Gewoon eerlijke matching.\n\nZullen we beginnen?`,
    lets_go: "Ja, laten we gaan!",
    ask_name: "Top! Laten we beginnen — wat is je volledige naam?",
    nice_to_meet: (name: string) => `Leuk je te ontmoeten, ${name}!`,
    occupants_q: (name: string) => `${name}, ga je alleen wonen of met anderen?`,
    occ_1: "Alleen", occ_2: "Met z'n twee\u00ebn", occ_3: "3 personen", occ_4: "4+",
    move_q: "Wanneer wil je verhuizen?",
    move_this: "Zo snel mogelijk", move_next: "Volgende maand", move_later: "Over 2-3 maanden", move_flex: "Flexibel",
    emp_q: "Wat doe je voor werk?",
    emp_loon: "In loondienst", emp_zzp: "ZZP'er", emp_student: "Student", emp_uitkering: "Uitkering",
    income_q: "Wat is ongeveer je bruto maandinkomen? Dit blijft priv\u00e9.",
    inc_1: "Onder \u20AC1.500", inc_2: "\u20AC1.500-\u20AC2.500", inc_3: "\u20AC2.500-\u20AC3.500", inc_4: "\u20AC3.500-\u20AC5.000", inc_5: "\u20AC5.000+",
    lease_q: "Hoe lang wil je blijven?",
    lease_6: "~6 maanden", lease_12: "Ongeveer een jaar", lease_2plus: "2+ jaar", lease_max: "Zo lang mogelijk",
    smoking_q: "Rook je?",
    smoke_no: "Nee", smoke_outside: "Alleen buiten", smoke_yes: "Ja",
    pets_q: "Neem je huisdieren mee?",
    pets_none: "Geen huisdieren", pets_cat: "Kat", pets_dog: "Hond", pets_other: "Anders",
    bkr_q: "Laatste vraag — heb je openstaande schulden of eerder problemen gehad met huur betalen?",
    bkr_clean: "Nee, alles goed", bkr_yes: "Ja, kan het uitleggen",
    consent_msg: (name: string) => `Bijna klaar ${name}! Door verder te gaan, ga je ermee akkoord dat je gegevens mogen worden gebruikt om je aanvraag te verifi\u00ebren onder de AVG/GDPR.\n\nTyp *"Ik ga akkoord"* om af te ronden.`,
    consent_remind: (name: string) => `Typ *"Ik ga akkoord"* om verder te gaan, ${name}.`,
    social_ask: (name: string) => `Bedankt ${name}!\n\nLaatste optionele stap — plak een link naar je *LinkedIn*, *Instagram* of *Facebook* profiel. Zo krijgt de verhuurder een beter beeld van je.\n\nPlak de volledige URL, of tik op Overslaan.`,
    skip_social: "Overslaan",
    done_msg: (name: string) => `Je bent klaar ${name}! Je screening is voltooid en de verhuurder zal je profiel bekijken. Als ze enthousiast zijn, stuur ik je hier de beschikbare bezichtigingstijden.\n\nBedankt voor het doorlopen van het proces!`,
    use_buttons: (name: string) => `Hoi ${name}, kun je de knoppen gebruiken om te antwoorden?`,
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
// SCREENING QUESTIONS — identical to telegram-screener
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
// MATCH SCORE — identical to telegram-screener
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
// SLOT GENERATION — identical to telegram-screener
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
  // ── GET: Meta webhook verification ──────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('Missing WhatsApp credentials');
    return new Response('Server error', { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    // ── INTERNAL ACTIONS (called from frontend / telegram-notify-tenant) ────
    // These mirror the telegram-screener internal actions but send via WhatsApp.
    // The recipient phone number is stored in applicant.whatsapp_phone.

    if (body.action === 'send_slots') {
      const { applicant_id, property_id, landlord_id } = body;
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ error: 'Applicant not found' }), { status: 404 });

      const waTo = appData.whatsapp_phone;
      if (!waTo) return new Response(JSON.stringify({ error: 'No WhatsApp phone on applicant' }), { status: 400 });

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const { data: propData } = await supabase.from('landlord_properties').select('address').eq('id', property_id).single();
      const address = propData?.address || 'the property';

      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', landlord_id);
      if (!schedule || schedule.length === 0) {
        await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waTo,
          `Hey ${firstName}! The landlord loved your profile and wants to meet you. They're setting up viewing times right now — I'll send you the options as soon as they're ready.`);
        return new Response(JSON.stringify({ ok: true }));
      }

      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', landlord_id);
      const slots = generateAvailableSlots(schedule, bookings || []);

      if (slots.length === 0) {
        await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waTo,
          `Hey ${firstName}! The landlord loved your application. All viewing times are full right now, but I'll message you the moment a slot opens up.`);
        return new Response(JSON.stringify({ ok: true }));
      }

      const displaySlots = slots.slice(0, 6);
      await supabase.from('applicants').update({ pending_viewing_slots: JSON.stringify(displaySlots) }).eq('id', applicant_id);

      const msgText = displaySlots.length === 1
        ? `Hey ${firstName}! Great news — the landlord would love to show you the place at *${address}*.\n\nHow does *${displaySlots[0].label}* work for you?`
        : `Hey ${firstName}! Great news — the landlord would love to show you the place at *${address}*.\n\nPick a viewing time that works for you:`;

      // Use a list message for slot selection (up to 6 slots)
      await sendList(PHONE_NUMBER_ID, ACCESS_TOKEN, waTo, stripHtml(msgText),
        displaySlots.map((slot, i) => ({ id: `vslot_${i}`, title: slot.label })),
        'Pick a time'
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_rejection') {
      const { applicant_id } = body;
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ ok: true }));

      const waTo = appData.whatsapp_phone;
      if (!waTo) return new Response(JSON.stringify({ ok: true }));

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const { data: propData } = await supabase.from('landlord_properties').select('address').eq('id', appData.property_id).single();
      const address = propData?.address || 'the property';

      await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waTo,
        `Hi ${firstName},\n\nThanks so much for taking the time to apply for ${address}. The landlord has decided to go in a different direction this time.\n\nI know it's not the news you were hoping for, but don't give up — the right place is out there. Good luck with your search.`
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    if (body.action === 'send_confirmation') {
      const { applicant_id, slot_start, address } = body;
      const { data: appData } = await supabase.from('applicants').select('*').eq('id', applicant_id).single();
      if (!appData) return new Response(JSON.stringify({ ok: true }));

      const waTo = appData.whatsapp_phone;
      if (!waTo) return new Response(JSON.stringify({ ok: true }));

      const firstName = (appData.full_name || 'there').split(' ')[0];
      const dt = new Date(slot_start);
      const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

      await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waTo,
        `It's official, ${firstName}!\n\nYour viewing is confirmed:\n\n*${dateStr} at ${timeStr}*\n*${address}*\n${mapsLink}\n\nI'll send you a reminder the day before. See you there!`
      );
      return new Response(JSON.stringify({ ok: true }));
    }

    // ── WHATSAPP WEBHOOK ─────────────────────────────────────────────────────
    // Meta sends both message events and delivery status updates to the same URL.
    // Only process message events (object === 'whatsapp_business_account').
    if (body.object !== 'whatsapp_business_account') {
      return new Response('OK', { status: 200 });
    }

    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value) return new Response('OK', { status: 200 });

    // Ignore delivery status updates — only care about messages
    if (value.statuses && !value.messages) return new Response('OK', { status: 200 });

    const messages = value.messages;
    if (!messages || messages.length === 0) return new Response('OK', { status: 200 });

    const message = messages[0];
    const waUserId = message.from; // phone number, e.g. "31612345678"

    // ── Interactive reply (button or list selection) ──────────────────────
    if (message.type === 'interactive') {
      const interactive = message.interactive;
      let callbackData: string | null = null;
      if (interactive?.type === 'button_reply') callbackData = interactive.button_reply?.id;
      else if (interactive?.type === 'list_reply') callbackData = interactive.list_reply?.id;

      if (!callbackData) return new Response('OK', { status: 200 });

      const { data: applicant } = await supabase
        .from('applicants').select('*').eq('whatsapp_phone', waUserId).maybeSingle();

      if (applicant) {
        await handleCallback(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId, applicant, callbackData);
      }
      return new Response('OK', { status: 200 });
    }

    // ── Text message ──────────────────────────────────────────────────────
    if (message.type !== 'text') return new Response('OK', { status: 200 });

    const text = message.text?.body?.trim() || '';
    if (!text) return new Response('OK', { status: 200 });

    // Check if this phone number belongs to a current tenant (post-contract concierge)
    const { data: tenantProperty } = await supabase
      .from('landlord_properties')
      .select('*')
      .eq('tenant_whatsapp_phone', waUserId)
      .eq('status', 'rented')
      .maybeSingle();

    if (tenantProperty) {
      if (text.toLowerCase().startsWith('start')) {
        const firstName = (tenantProperty.tenant_name || 'there').split(' ')[0];
        await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
          `Hey ${firstName}! I'm your assistant for ${tenantProperty.address}. Ask me anything about the place — wifi, heating, waste schedule, contract terms, maintenance contacts, you name it.`);
        return new Response('OK', { status: 200 });
      }
      await handleTenantConcierge(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId, tenantProperty, text);
      return new Response('OK', { status: 200 });
    }

    // Check for existing applicant
    const { data: applicant } = await supabase
      .from('applicants').select('*').eq('whatsapp_phone', waUserId).maybeSingle();

    if (!applicant) {
      // New user — expect "start {propertyId}" (wa.me link sends "start+ID" which WhatsApp
      // delivers as "start ID" after URL-decoding, but handle the literal "start+ID" form too)
      const normalised = text.trim().replace(/^start\+/i, 'start ');
      const parts = normalised.toLowerCase().trim().split(/\s+/);
      if (parts[0] === 'start' && parts[1]) {
        const propertyId = parts[1];
        const { data: property } = await supabase
          .from('landlord_properties')
          .select('id, address, landlord_id, status, tenant_name, tenant_whatsapp_phone')
          .eq('id', propertyId).maybeSingle();

        if (!property) {
          await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
            `Hmm, that link doesn't seem to work. Could you double-check with your landlord?`);
          return new Response('OK', { status: 200 });
        }

        // Rented property with no tenant claimed yet — register as the tenant
        if (property.status === 'rented' && !property.tenant_whatsapp_phone) {
          await supabase.from('landlord_properties').update({
            tenant_whatsapp_phone: waUserId,
          }).eq('id', property.id);
          await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
            `Hey! I'm your assistant for ${property.address}. Hope you enjoy your stay! Ask me anything about the place — wifi, heating, waste schedule, contract terms, maintenance contacts, you name it.`);
          return new Response('OK', { status: 200 });
        }

        if (property.status === 'rented') {
          await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
            `Hey! This property is already occupied. If you're the tenant and this is wrong, please ask your landlord to update your contact details.`);
          return new Response('OK', { status: 200 });
        }

        // Create applicant and ask for language
        await supabase.from('applicants').insert({
          whatsapp_phone: waUserId,
          property_id: propertyId,
          stage: 'lang_select',
          preferred_language: 'en',
        });

        await sendButtons(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
          `Hey! Before we begin, which language do you prefer?\n\nHoi! In welke taal wil je verdergaan?`,
          [
            { id: 'lang_en', title: 'English' },
            { id: 'lang_nl', title: 'Nederlands' },
            { id: 'lang_other', title: 'Other / Anders' },
          ]
        );
      } else {
        await sendText(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
          `Hey! You need a screening link from your landlord to get started. Ask them for it.`);
      }
      return new Response('OK', { status: 200 });
    }

    // Handle lang_other_input stage (typed language preference)
    if (applicant.stage === 'lang_other_input') {
      await supabase.from('applicants').update({ preferred_language: text.toLowerCase(), stage: 'welcome' }).eq('id', applicant.id);
      const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
      const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
      const landlordName = landlord?.full_name?.split(' ')[0] || 'your landlord';
      await sendButtons(PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId,
        tr('en', 'welcome', 'there', landlordName, property?.address || 'the property'),
        [
          { id: 'start_yes', title: "Let's do it!" },
          { id: 'start_info', title: 'What is this?' },
        ]
      );
      return new Response('OK', { status: 200 });
    }

    await handleTextMessage(supabase, PHONE_NUMBER_ID, ACCESS_TOKEN, waUserId, applicant, text);
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('whatsapp-screener error:', error);
    return new Response('OK', { status: 200 });
  }
});

// ═══════════════════════════════════════════
// CALLBACK / INTERACTIVE REPLY HANDLER
// ═══════════════════════════════════════════
async function handleCallback(supabase: any, phoneNumberId: string, token: string, waTo: string, applicant: any, data: string) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const lang = applicant.preferred_language || 'en';
  const useLang = (lang === 'en' || lang === 'nl') ? lang : 'en';

  // Language selection
  if (data === 'lang_en' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ preferred_language: 'en', stage: 'welcome' }).eq('id', applicant.id);
    const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
    const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
    const landlordName = landlord?.full_name?.split(' ')[0] || 'your landlord';
    await sendButtons(phoneNumberId, token, waTo,
      tr('en', 'welcome', firstName, landlordName, property?.address || 'the property'),
      [
        { id: 'start_yes', title: "Let's do it!" },
        { id: 'start_info', title: 'What is this?' },
      ]
    );
    return;
  }

  if (data === 'lang_nl' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ preferred_language: 'nl', stage: 'welcome' }).eq('id', applicant.id);
    const { data: property } = await supabase.from('landlord_properties').select('address, landlord_id').eq('id', applicant.property_id).single();
    const { data: landlord } = await supabase.from('landlords').select('full_name').eq('id', property?.landlord_id).maybeSingle();
    const landlordName = landlord?.full_name?.split(' ')[0] || 'je verhuurder';
    await sendButtons(phoneNumberId, token, waTo,
      tr('nl', 'welcome', firstName, landlordName, property?.address || 'de woning'),
      [
        { id: 'start_yes', title: 'Beginnen!' },
        { id: 'start_info', title: 'Wat is dit?' },
      ]
    );
    return;
  }

  if (data === 'lang_other' && applicant.stage === 'lang_select') {
    await supabase.from('applicants').update({ stage: 'lang_other_input' }).eq('id', applicant.id);
    await sendText(phoneNumberId, token, waTo,
      `Please type your preferred language (e.g. "Spanish", "German", "Arabic").\n\nNote: we'll do our best, but the screening will continue in English.`);
    return;
  }

  if (data === 'start_yes') {
    await supabase.from('applicants').update({ stage: 'name' }).eq('id', applicant.id);
    await sendText(phoneNumberId, token, waTo, tr(useLang, 'ask_name'));
    return;
  }

  if (data === 'start_info') {
    await sendButtons(phoneNumberId, token, waTo,
      tr(useLang, 'info_reply'),
      [{ id: 'start_yes', title: tr(useLang, 'lets_go') }]
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
        await sendWA(phoneNumberId, token, waTo, question,
          nextQ.options.map(o => ({ id: o.callback, title: tr(useLang, o.textKey) }))
        );
      } else if (q.nextStage === 'consent') {
        await sendText(phoneNumberId, token, waTo, tr(useLang, 'consent_msg', firstName));
      }
      return;
    }
  }

  // Skip social
  if (data === 'skip_social') {
    await supabase.from('applicants').update({ stage: 'screening_complete' }).eq('id', applicant.id);
    await runMatchScoring(supabase, applicant.id);
    await sendText(phoneNumberId, token, waTo, tr(useLang, 'done_msg', firstName));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/social-media-scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ applicantId: applicant.id }),
    }).catch(err => console.error('Background scrape failed:', err));
    return;
  }

  // Viewing slot selection
  if (data.startsWith('vslot_')) {
    const slotIndex = parseInt(data.replace('vslot_', ''));
    let availableSlots: any[] = [];
    try { availableSlots = JSON.parse(applicant.pending_viewing_slots || '[]'); } catch {}
    const selectedSlot = availableSlots[slotIndex];
    if (!selectedSlot) {
      await sendText(phoneNumberId, token, waTo,
        `Hmm, that time doesn't seem available anymore ${firstName}. The landlord will send you fresh options soon.`);
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
      await sendText(phoneNumberId, token, waTo, `Oh no, someone just grabbed that slot. Let me check what else is available...`);
      const { data: schedule } = await supabase.from('viewing_schedule').select('*').eq('landlord_id', property.landlord_id);
      const { data: bookings } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', property.landlord_id);
      const freshSlots = generateAvailableSlots(schedule || [], bookings || []);
      if (freshSlots.length > 0) {
        const display = freshSlots.slice(0, 6);
        await supabase.from('applicants').update({ pending_viewing_slots: JSON.stringify(display) }).eq('id', applicant.id);
        await sendList(phoneNumberId, token, waTo,
          `Here are the available times — pick one that works for you:`,
          display.map((s, i) => ({ id: `vslot_${i}`, title: s.label })),
          'Pick a time'
        );
      } else {
        await sendText(phoneNumberId, token, waTo, `All slots are taken right now. I'll message you when new ones open up.`);
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
      await sendText(phoneNumberId, token, waTo, `Something went wrong booking that slot. The landlord will send new times shortly.`);
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
    await sendText(phoneNumberId, token, waTo,
      `Nice choice, ${firstName}!\n\nYou picked *${selectedSlot.label}* at *${property.address}*.\n${mapsLink}\n\nI've sent this to the landlord for approval — you'll get a confirmation as soon as they say yes. Hang tight.`
    );
    await runMatchScoring(supabase, applicant.id);
    return;
  }

  // Reminder: tenant confirms attendance
  if (data === 'remind_yes') {
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
      await sendText(phoneNumberId, token, waTo,
        `Perfect, see you tomorrow at ${timeStr}. The address is ${prop?.address || 'the property'}. Good luck!`);
    } else {
      await sendText(phoneNumberId, token, waTo, `Great, see you there ${firstName}!`);
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

      await sendText(phoneNumberId, token, waTo,
        `No problem ${firstName}, your viewing has been cancelled. I hope you find a great place.`);
      await triggerCascade(supabase, phoneNumberId, token, booking, timeoutMin);
    }
    return;
  }

  // Cascade: candidate claims the slot
  if (data.startsWith('cascade_yes_')) {
    const bookingId = data.replace('cascade_yes_', '');
    const { data: booking } = await supabase.from('viewing_bookings').select('*').eq('id', bookingId).single();
    if (!booking || booking.cascade_state !== 'active') {
      await sendText(phoneNumberId, token, waTo, `Sorry ${firstName}, that slot has already been taken.`);
      return;
    }

    const cascadeData = booking.cascade_data || {};
    const candidates = cascadeData.candidates || [];
    const alreadyClaimed = candidates.some((c: any) => c.response === 'yes');
    if (alreadyClaimed) {
      await sendText(phoneNumberId, token, waTo,
        `Sorry ${firstName}, someone else just claimed that slot. We will keep you posted on future viewings.`);
      return;
    }

    const updatedCandidates = candidates.map((c: any) =>
      c.applicant_id === applicant.id ? { ...c, response: 'yes' } : c
    );

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

    await sendText(phoneNumberId, token, waTo,
      `You got it ${firstName}! Your viewing is confirmed:\n\n*${dateStr} at ${timeStr}*\n*${addr}*\n${mapsLink}\n\nI will send you a reminder beforehand.`
    );

    for (const c of updatedCandidates) {
      if (c.applicant_id !== applicant.id && c.wa_to && c.response !== 'no') {
        await sendText(phoneNumberId, token, c.wa_to,
          `Thanks, the slot has just been filled. We will keep you posted on future viewings.`);
      }
    }

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

      const allDeclined = updatedCandidates.every((c: any) => c.response === 'no');
      if (allDeclined) {
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
    await sendText(phoneNumberId, token, waTo,
      `No worries ${firstName}. We will let you know about future viewing opportunities.`);
    return;
  }
}

// ═══════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════
function extractName(raw: string): string | null {
  let s = (raw || '').trim().replace(/[.!?,;:"']+$/g, '').trim();
  if (!s) return null;
  const patterns = [
    /^(?:my\s+name\s+is|i\s*am|i'm|im|this\s+is|name['']?s|call\s+me|they\s+call\s+me)\s+(.+)$/i,
    /^(?:mijn\s+naam\s+is|ik\s+ben|ik\s+heet|men\s+noemt\s+mij|noem\s+mij)\s+(.+)$/i,
    /^(?:hi|hello|hey|hoi|hallo)[,!\s]+(?:my\s+name\s+is|i\s*am|i'm|im|mijn\s+naam\s+is|ik\s+ben|ik\s+heet)\s+(.+)$/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m && m[1]) { s = m[1].trim().replace(/[.!?,;:"']+$/g, '').trim(); break; }
  }
  s = s.split(/\s+(?:and|en)\s+/i)[0].trim();
  const tokens = s.split(/\s+/).filter(Boolean).slice(0, 4);
  if (!tokens.length) return null;
  if (tokens.some(t => /https?:\/\/|@|\d/.test(t))) return null;
  const cleaned = tokens
    .map(t => t.replace(/[^\p{L}\-']/gu, ''))
    .filter(Boolean)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1));
  if (!cleaned.length) return null;
  const joined = cleaned.join(' ');
  if (joined.length < 2 || joined.length > 60) return null;
  return joined;
}

async function handleTextMessage(supabase: any, phoneNumberId: string, token: string, waTo: string, applicant: any, text: string) {
  const stage = applicant.stage;
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const lang = applicant.preferred_language || 'en';
  const useLang = (lang === 'en' || lang === 'nl') ? lang : 'en';

  if (stage === 'name') {
    const name = extractName(text);
    if (!name) {
      await sendText(phoneNumberId, token, waTo, useLang === 'nl'
        ? "Sorry, ik kon je naam niet herkennen. Kun je alleen je volledige naam typen? Bijvoorbeeld: Jan de Vries"
        : "Sorry, I couldn't catch your name. Could you just type your full name? For example: John Smith");
      return;
    }
    const first = name.split(' ')[0];
    await supabase.from('applicants').update({ full_name: name, stage: 'q_occupants' }).eq('id', applicant.id);
    const firstQ = SCREENING_QUESTIONS[0];
    const question = tr(useLang, firstQ.questionKey, first);
    await sendWA(phoneNumberId, token, waTo,
      `${tr(useLang, 'nice_to_meet', first)}\n\n${question}`,
      firstQ.options.map(o => ({ id: o.callback, title: tr(useLang, o.textKey) }))
    );
    return;
  }

  if (stage === 'consent') {
    if (text.toLowerCase().includes('agree') || text.toLowerCase().includes('akkoord')) {
      await supabase.from('applicants').update({ consent_given: true, stage: 'socials' }).eq('id', applicant.id);
      await sendButtons(phoneNumberId, token, waTo,
        tr(useLang, 'social_ask', firstName),
        [{ id: 'skip_social', title: tr(useLang, 'skip_social') }]
      );
    } else {
      await sendText(phoneNumberId, token, waTo, tr(useLang, 'consent_remind', firstName));
    }
    return;
  }

  if (stage === 'socials') {
    const handle = text.trim();
    await supabase.from('applicants').update({ social_handle: handle, stage: 'screening_complete' }).eq('id', applicant.id);
    await runMatchScoring(supabase, applicant.id);
    await sendText(phoneNumberId, token, waTo, tr(useLang, 'done_msg', firstName));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/social-media-scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ applicantId: applicant.id }),
    }).catch(err => console.error('Background scrape failed:', err));
    return;
  }

  if (stage === 'done' || stage === 'screening_complete' || stage === 'viewing_pending' || stage === 'approved' || stage === 'viewing_booked') {
    const lower = text.toLowerCase().trim();
    if (lower === 'yes' || lower === 'ja') {
      const { data: bk } = await supabase.from('viewing_bookings')
        .select('id, slot_start, property_id')
        .eq('applicant_id', applicant.id).eq('status', 'confirmed')
        .not('reminder_24h_sent_at', 'is', null).is('reminder_24h_response', null)
        .order('slot_start', { ascending: true }).limit(1).maybeSingle();
      if (bk) {
        await supabase.from('viewing_bookings').update({ reminder_24h_response: 'yes' }).eq('id', bk.id);
        const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', bk.property_id).single();
        const dt = new Date(bk.slot_start);
        const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        await sendText(phoneNumberId, token, waTo,
          `Perfect, see you tomorrow at ${timeStr}. The address is ${prop?.address || 'the property'}. Good luck!`);
        return;
      }
    }
    if (lower === 'no' || lower === 'nee') {
      const { data: bk } = await supabase.from('viewing_bookings')
        .select('*').eq('applicant_id', applicant.id).eq('status', 'confirmed')
        .not('reminder_24h_sent_at', 'is', null).is('reminder_24h_response', null)
        .order('slot_start', { ascending: true }).limit(1).maybeSingle();
      if (bk) {
        await sendButtons(phoneNumberId, token, waTo,
          `Got it ${firstName}, would you like me to cancel your viewing?`,
          [
            { id: 'remind_cancel', title: 'Yes, cancel it' },
            { id: 'remind_yes', title: 'No, keep it' },
          ]
        );
        return;
      }
    }
    await handleAIResponse(supabase, phoneNumberId, token, waTo, applicant, text);
    return;
  }

  if (stage?.startsWith('q_')) {
    await sendText(phoneNumberId, token, waTo, tr(useLang, 'use_buttons', firstName));
    return;
  }

  await handleAIResponse(supabase, phoneNumberId, token, waTo, applicant, text);
}

// ═══════════════════════════════════════════
// CASCADE TRIGGER
// ═══════════════════════════════════════════
async function triggerCascade(supabase: any, phoneNumberId: string, token: string, booking: any, timeoutMinutes: number) {
  const { data: candidates } = await supabase.from('applicants')
    .select('id, whatsapp_phone, full_name, match_score')
    .eq('property_id', booking.property_id)
    .in('stage', ['approved', 'screening_complete'])
    .is('viewing_booked_at', null)
    .eq('hard_disqualified', false)
    .neq('id', booking.applicant_id)
    .order('match_score', { ascending: false })
    .limit(3);

  if (!candidates || candidates.length === 0) {
    const { data: prop } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
    const dt = new Date(booking.slot_start);
    const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    await supabase.from('notifications').insert({
      landlord_id: booking.landlord_id,
      type: 'cancellation_no_replacement',
      title: `Viewing cancelled — no replacement found`,
      message: `Your viewing on ${dateStr} at ${timeStr} for ${prop?.address || 'the property'} was cancelled and no replacement was found.`,
      related_booking_id: booking.id,
    });
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
    const waTo = c.whatsapp_phone;
    if (!waTo) continue;
    const cFirstName = (c.full_name || 'there').split(' ')[0];
    await sendButtons(phoneNumberId, token, waTo,
      `Hi ${cFirstName}, a viewing slot just opened up at ${addr} on ${dateStr} at ${timeStr}. Are you available? First to confirm gets the slot.`,
      [
        { id: `cascade_yes_${booking.id}`, title: 'YES, I want it' },
        { id: `cascade_no_${booking.id}`, title: 'No, not available' },
      ]
    );
    cascadeCandidates.push({ applicant_id: c.id, wa_to: waTo, full_name: c.full_name, response: null });
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
// AI RESPONSE HANDLER
// ═══════════════════════════════════════════
async function handleAIResponse(supabase: any, phoneNumberId: string, token: string, waTo: string, applicant: any, userText: string) {
  const firstName = (applicant.full_name || 'there').split(' ')[0];
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  if (!LOVABLE_API_KEY) {
    await sendText(phoneNumberId, token, waTo,
      `Hey ${firstName}! Your application is with the landlord — I'll message you as soon as there's an update. Hang tight.`);
    return;
  }

  try {
    const cancelWords = ['cancel', 'annuleren', 'afzeggen', "can't make it", 'cant make it', 'not coming', 'cancel viewing', 'cancel my viewing'];
    const lowerText = userText.toLowerCase();
    if (cancelWords.some(w => lowerText.includes(w))) {
      const { data: booking } = await supabase.from('viewing_bookings')
        .select('*').eq('applicant_id', applicant.id)
        .in('status', ['confirmed', 'pending_landlord'])
        .order('slot_start', { ascending: true })
        .limit(1).maybeSingle();
      if (booking) {
        await sendButtons(phoneNumberId, token, waTo,
          `Got it ${firstName}, would you like me to cancel your viewing?`,
          [
            { id: 'remind_cancel', title: 'Yes, cancel it' },
            { id: 'remind_yes', title: 'No, keep it' },
          ]
        );
      } else {
        await sendText(phoneNumberId, token, waTo,
          `Hey ${firstName}, I don't see any upcoming viewings to cancel. If you think this is wrong, just let me know.`);
      }
      return;
    }

    const { data: property } = await supabase.from('landlord_properties')
      .select('address, city, rent_amount, surface_m2, num_rooms, property_type, accommodation_type, building_year, energy_label, furnished_status, available_date, min_lease_length, postcode, knowledge_base_text')
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

    const systemPrompt = `You are a friendly, helpful rental assistant for FairKamer. You chat with tenants via WhatsApp about their rental application.

Your personality:
- Warm, casual, helpful — like texting a friend who works in real estate
- Use the tenant's first name (${firstName})
- Keep responses SHORT (2-4 sentences max) — this is WhatsApp, not email
- Do NOT use emojis at all. Keep it professional and clean.
- Always be encouraging and supportive

PROPERTY INFO:
${propertyContext || 'No property details available yet.'}
${bookingContext}

${property?.knowledge_base_text ? `PROPERTY KNOWLEDGE BASE (uploaded by the landlord — use this to answer specific questions about wifi, appliances, house rules, contract terms, etc.):
${property.knowledge_base_text}
` : ''}
TENANT STATUS: ${stageContext}

LANGUAGE: ${langInstruction}

RULES:
- Answer questions about the property using the info and knowledge base above
- Quote specifics verbatim (wifi passwords, codes, numbers) — never paraphrase them
- If you don't have info the tenant asks about, say something like "Good question! I don't have that detail handy — I'd suggest asking the landlord directly."
- If they want to cancel, ask them to confirm with the cancel button
- If they ask about their application status, use the tenant status above
- NEVER make up property details you don't have
- NEVER discuss other applicants
- Plain text only. No markdown.`;

    const response = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
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
      await sendText(phoneNumberId, token, waTo,
        `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back from the landlord. Hang tight.`);
      return;
    }

    const result = await response.json();
    const aiReply = result.choices?.[0]?.message?.content;
    if (aiReply?.trim()) {
      await sendText(phoneNumberId, token, waTo, aiReply.trim());
    } else {
      await sendText(phoneNumberId, token, waTo,
        `Hey ${firstName}! Your application is being reviewed — I'll update you as soon as I hear back. Sit tight.`);
    }
  } catch (err) {
    console.error('[AI] Error:', err);
    await sendText(phoneNumberId, token, waTo,
      `Hey ${firstName}! I'm here if you need anything. Your application is with the landlord — I'll let you know as soon as there's news.`);
  }
}

// ═══════════════════════════════════════════
// TENANT CONCIERGE (post-contract)
// ═══════════════════════════════════════════
async function handleTenantConcierge(supabase: any, phoneNumberId: string, token: string, waTo: string, property: any, userText: string) {
  const tenantFirst = (property.tenant_name || 'there').split(' ')[0];
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  if (!LOVABLE_API_KEY) {
    await sendText(phoneNumberId, token, waTo,
      `Hey ${tenantFirst}! I'm temporarily offline — please reach out to your landlord directly.`);
    return;
  }

  const issueWords = ['broken', 'leak', 'leaking', 'not working', "doesn't work", 'doesnt work', 'no hot water', 'no heating', 'mold', 'mould', 'urgent', 'emergency', 'kapot', 'lekt', 'werkt niet', 'storing'];
  const lower = userText.toLowerCase();
  if (issueWords.some(w => lower.includes(w))) {
    try {
      await supabase.from('tenant_issues').insert({
        property_id: property.id,
        message: userText,
        tenant_name: property.tenant_name || null,
        whatsapp_phone: property.tenant_whatsapp_phone || null,
        category: 'needs_attention',
      });
    } catch (e) {
      console.error('[tenant-concierge] issue log failed', e);
    }
  }

  const details: string[] = [];
  if (property.address) details.push(`Address: ${property.address}`);
  if (property.city) details.push(`City: ${property.city}`);
  if (property.postcode) details.push(`Postcode: ${property.postcode}`);
  if (property.tenant_monthly_rent || property.rent_amount) details.push(`Rent: \u20AC${property.tenant_monthly_rent || property.rent_amount}/month`);
  if (property.tenant_deposit) details.push(`Deposit: \u20AC${property.tenant_deposit}`);
  if (property.tenant_contract_start) details.push(`Contract start: ${property.tenant_contract_start}`);
  if (property.surface_m2) details.push(`Surface: ${property.surface_m2}m\u00B2`);
  if (property.building_year) details.push(`Building year: ${property.building_year}`);
  if (property.energy_label) details.push(`Energy label: ${property.energy_label}`);
  if (property.num_rooms) details.push(`Rooms: ${property.num_rooms}`);

  const systemPrompt = `You are the post-contract concierge assistant for a tenant who is currently living at this property. You speak with them via WhatsApp.

Your personality:
- Warm, casual, helpful — like texting a friend who knows the building inside out
- Use the tenant's first name (${tenantFirst})
- Keep responses SHORT (2-4 sentences). This is WhatsApp, not email.
- Do NOT use emojis. Keep it professional and clean.

PROPERTY (the tenant lives here):
${details.join('\n')}

${property.knowledge_base_text ? `PROPERTY KNOWLEDGE BASE (uploaded by the landlord — house rules, wifi, appliances, contract terms, contacts, etc.):
${property.knowledge_base_text}
` : "NOTE: No knowledge base has been uploaded yet. If asked something specific, tell them honestly you don't have that detail and suggest contacting the landlord."}

RULES:
- This person is the CURRENT TENANT, not an applicant. Never ask screening questions.
- Quote specifics verbatim (wifi passwords, codes, contact numbers) — never paraphrase.
- For maintenance issues acknowledge it warmly, tell them you've logged it for the landlord, and share any relevant emergency contact from the knowledge base.
- If you don't have info, say so honestly and suggest contacting the landlord.
- Reply in the language the tenant writes in (English or Dutch).
- Plain text only.`;

  try {
    const response = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
    });
    if (!response.ok) {
      console.error('[tenant-concierge] AI error', response.status, await response.text());
      await sendText(phoneNumberId, token, waTo,
        `Hey ${tenantFirst}! I'm having a hiccup — please try again in a moment, or reach out to your landlord directly.`);
      return;
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    await sendText(phoneNumberId, token, waTo, reply || `Hey ${tenantFirst}! I'm here — could you rephrase that?`);
  } catch (err) {
    console.error('[tenant-concierge] error', err);
    await sendText(phoneNumberId, token, waTo,
      `Hey ${tenantFirst}! I'm having trouble reaching the system. Please try again shortly.`);
  }
}
