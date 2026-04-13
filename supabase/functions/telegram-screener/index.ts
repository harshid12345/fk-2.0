import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

// ═══════════════════════════════════════════
// SCREENING QUESTIONS
// ═══════════════════════════════════════════
const SCREENING_QUESTIONS = [
  {
    id: 'occupants',
    stage: 'q_occupants',
    question: "How many people will be moving in (including you)?",
    options: [
      { text: "Just me", callback: 'occ_1' },
      { text: "2 people", callback: 'occ_2' },
      { text: "3 people", callback: 'occ_3' },
      { text: "4+", callback: 'occ_4' },
    ],
    dbField: 'num_occupants',
    valueMap: { 'occ_1': 'Just me', 'occ_2': '2 people', 'occ_3': '3 people', 'occ_4': '4+' },
    nextStage: 'q_move_in',
  },
  {
    id: 'move_in_date',
    stage: 'q_move_in',
    question: "When are you looking to move in?",
    options: [
      { text: "This month", callback: 'move_this' },
      { text: "Next month", callback: 'move_next' },
      { text: "In 2-3 months", callback: 'move_later' },
      { text: "Flexible", callback: 'move_flex' },
    ],
    dbField: 'desired_move_in',
    valueMap: { 'move_this': 'This month', 'move_next': 'Next month', 'move_later': 'In 2-3 months', 'move_flex': 'Flexible' },
    nextStage: 'q_employment',
  },
  {
    id: 'employment',
    stage: 'q_employment',
    question: "What is your employment situation?",
    options: [
      { text: "💼 Loondienst (employed)", callback: 'emp_loon' },
      { text: "🏢 ZZP (self-employed)", callback: 'emp_zzp' },
      { text: "🎓 Student", callback: 'emp_student' },
      { text: "Uitkering (benefits)", callback: 'emp_uitkering' },
    ],
    dbField: 'employment_type',
    valueMap: { 'emp_loon': 'Loondienst (employed)', 'emp_zzp': 'ZZP (self-employed)', 'emp_student': 'Student', 'emp_uitkering': 'Uitkering (benefits)' },
    nextStage: 'q_income',
  },
  {
    id: 'income',
    stage: 'q_income',
    question: "What is your gross monthly income (€)?",
    options: [
      { text: "Under €1,500", callback: 'inc_1' },
      { text: "€1,500 - €2,500", callback: 'inc_2' },
      { text: "€2,500 - €3,500", callback: 'inc_3' },
      { text: "€3,500 - €5,000", callback: 'inc_4' },
      { text: "€5,000+", callback: 'inc_5' },
    ],
    dbField: 'monthly_income',
    valueMap: { 'inc_1': 1250, 'inc_2': 2000, 'inc_3': 3000, 'inc_4': 4250, 'inc_5': 5500 },
    incomeRange: { 'inc_1': 'Under €1,500', 'inc_2': '€1,500 - €2,500', 'inc_3': '€2,500 - €3,500', 'inc_4': '€3,500 - €5,000', 'inc_5': '€5,000+' },
    nextStage: 'q_lease',
  },
  {
    id: 'lease_length',
    stage: 'q_lease',
    question: "How long are you looking to rent for?",
    options: [
      { text: "6 months", callback: 'lease_6' },
      { text: "12 months", callback: 'lease_12' },
      { text: "2+ years", callback: 'lease_2plus' },
      { text: "As long as possible", callback: 'lease_max' },
    ],
    dbField: 'desired_lease_length',
    valueMap: { 'lease_6': '6 months', 'lease_12': '12 months', 'lease_2plus': '2+ years', 'lease_max': 'As long as possible' },
    nextStage: 'q_smoking',
  },
  {
    id: 'smoking',
    stage: 'q_smoking',
    question: "Do you smoke?",
    options: [
      { text: "No 🚭", callback: 'smoke_no' },
      { text: "Outside only", callback: 'smoke_outside' },
      { text: "Yes", callback: 'smoke_yes' },
    ],
    dbField: 'lifestyle_answers',
    lifestyleKey: 'smoking',
    valueMap: { 'smoke_no': 'No', 'smoke_outside': 'Outside only', 'smoke_yes': 'Yes' },
    nextStage: 'q_pets',
  },
  {
    id: 'pets',
    stage: 'q_pets',
    question: "Do you have any pets?",
    options: [
      { text: "No pets", callback: 'pets_none' },
      { text: "🐱 Cat", callback: 'pets_cat' },
      { text: "🐶 Dog", callback: 'pets_dog' },
      { text: "Other", callback: 'pets_other' },
    ],
    dbField: 'lifestyle_answers',
    lifestyleKey: 'pets',
    valueMap: { 'pets_none': 'No pets', 'pets_cat': 'Cat', 'pets_dog': 'Dog', 'pets_other': 'Other' },
    nextStage: 'q_bkr',
  },
  {
    id: 'bkr',
    stage: 'q_bkr',
    question: "Are you aware of any BKR registrations or rent arrears?",
    options: [
      { text: "No, clean record ✅", callback: 'bkr_clean' },
      { text: "Yes, I can explain", callback: 'bkr_yes' },
    ],
    dbField: 'bkr_status',
    valueMap: { 'bkr_clean': 'No, clean record', 'bkr_yes': 'Yes, I can explain' },
    nextStage: 'consent',
  },
];

// ═══════════════════════════════════════════
// MATCH SCORE (duplicated from lib for edge function)
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
    case 'Just me': return 1;
    case '2 people': return 2;
    case '3 people': return 3;
    case '4+': return 4;
    default: return 1;
  }
}

function calculateMatchScore(
  tenant: any, criteria: any, propertyRent: number, scrapeData: any
): { score: number; label: string; hardDisqualified: boolean; hardDisqualifyReason: string | null; breakdown: any; flags: string[] } {
  const flags: string[] = [];
  const answers = tenant.lifestyle_answers || {};
  const smoking = answers.smoking || null;
  const pets = answers.pets || null;
  const incomeRange = answers.income_range || null;
  const incomeEstimate = incomeRange ? getIncomeEstimate(incomeRange) : (tenant.monthly_income || 0);

  // HARD DISQUALIFIERS
  if (criteria?.smoking_allowed === 'No' && smoking === 'Yes') {
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Landlord does not allow smoking — tenant smokes', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: smoking'] };
  }
  if (criteria?.pets_allowed === 'No' && pets && pets !== 'No pets') {
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Landlord does not allow pets — tenant has pets', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: pets'] };
  }
  if (incomeEstimate > 0 && propertyRent > 0 && incomeEstimate < propertyRent * 2) {
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Income below 2x monthly rent', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: income too low'] };
  }
  if (tenant.bkr_status === 'Yes, I can explain') {
    return { score: 0, label: 'Disqualified', hardDisqualified: true, hardDisqualifyReason: 'Self-reported BKR registration or rent arrears', breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 }, flags: ['Hard disqualifier: BKR/arrears'] };
  }

  // BLOCK 1: PREFERENCE (max 4)
  let pref = 0;
  if (criteria?.smoking_allowed === 'Yes' || smoking === 'No') pref += 1;
  else if (criteria?.smoking_allowed === 'Outside only' && smoking === 'Outside only') pref += 1;
  else { pref -= 1; flags.push('Smoking preference mismatch'); }

  if (criteria?.pets_allowed === 'Yes' || !pets || pets === 'No pets') pref += 1;
  else if (criteria?.pets_allowed === 'Negotiable') { pref += 0.5; flags.push('Tenant has pets — landlord says negotiable'); }
  else { pref -= 1; flags.push('Pets preference mismatch'); }

  const occ = getOccupantNumber(tenant.num_occupants);
  if (occ <= (criteria?.max_occupants || 1)) pref += 1;
  else { pref -= 1; flags.push('Too many occupants for this property'); }

  if (tenant.desired_move_in === 'This month' || tenant.desired_move_in === 'Next month') pref += 1;
  else if (tenant.desired_move_in === 'Flexible') pref += 0.5;
  else { pref -= 0.5; flags.push('Move-in date may not align'); }
  pref = Math.max(0, Math.min(4, pref));

  // BLOCK 2: FINANCIAL (max 4)
  let fin = 0;
  const ratio = propertyRent > 0 ? incomeEstimate / propertyRent : 0;
  if (ratio >= 3) fin += 2.0;
  else if (ratio >= 2.5) fin += 1.0;

  switch (tenant.employment_type) {
    case 'Loondienst (employed)': fin += 1.0; break;
    case 'ZZP (self-employed)': fin += (scrapeData?.kvk?.yearsActive >= 2 ? 0.75 : 0.25); break;
    case 'Student': case 'Uitkering (benefits)': fin += 0.25; flags.push('Employment type: limited financial stability signal'); break;
    default: fin += 0.25;
  }
  fin += 0.5; // clean BKR
  fin = Math.max(0, Math.min(4, fin));

  // BLOCK 3: SCRAPED (max 2)
  let scr = scrapeData ? 0 : 1.0;
  if (scrapeData) {
    if (scrapeData.linkedin?.confirmsEmployer) scr += 0.5;
    if (scrapeData.kvk?.confirmed) scr += 0.5;
    if (scrapeData.socialConsistent) scr += 0.25;
    if (scrapeData.socialAccountAge >= 2) scr += 0.25;
    if (scrapeData.google?.noNegativeResults) scr += 0.5;
    else if (scrapeData.google?.negativeResults) { scr -= 0.5; flags.push('Negative mentions found in public search results'); }
    if (scrapeData.hibp?.flagged) { scr -= 0.5; flags.push('Email found in data breach records'); }
    if (scrapeData.socialInconsistent) { scr -= 0.5; flags.push('Social media profiles inconsistent'); }
  }
  scr = Math.max(0, Math.min(2, scr));

  const total = Math.round((pref + fin + scr) * 10) / 10;
  let label: string;
  if (total >= 8.5) label = 'Strong match';
  else if (total >= 6.5) label = 'Good match';
  else if (total >= 4.5) label = 'Moderate match';
  else label = 'Weak match';

  return { score: total, label, hardDisqualified: false, hardDisqualifyReason: null, breakdown: { preferenceScore: pref, financialScore: fin, scrapedScore: scr }, flags };
}

// ═══════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN');
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_SCREENER_TOKEN not configured');
    return new Response('Server error', { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const update = await req.json();

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      return new Response('OK');
    }

    // Handle regular messages
    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const telegramUserId = String(message.from.id);
    const photo = message.photo;

    const { data: applicant } = await supabase
      .from('applicants').select('*').eq('telegram_user_id', telegramUserId).maybeSingle();

    if (!applicant) {
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const propertyId = parts[1];
        if (!propertyId) {
          await sendMessage(BOT_TOKEN, chatId, "Welcome! Please use the screening link shared by your landlord to get started.");
          return new Response('OK');
        }
        const { data: property } = await supabase
          .from('landlord_properties').select('id, address, landlord_id').eq('id', propertyId).maybeSingle();
        if (!property) {
          await sendMessage(BOT_TOKEN, chatId, "Sorry, that property link doesn't seem valid. Please check with your landlord.");
          return new Response('OK');
        }
        const { data: landlord } = await supabase
          .from('landlords').select('full_name').eq('id', property.landlord_id).maybeSingle();

        await supabase.from('applicants').insert({
          telegram_user_id: telegramUserId,
          property_id: propertyId,
          stage: 'welcome',
        });

        const landlordName = landlord?.full_name || 'your landlord';
        await sendMessage(BOT_TOKEN, chatId,
          `Hey! 👋 I'm the FairKamer assistant for ${landlordName}.\n\nI help match tenants with the right home. It takes about 5 minutes and helps you stand out from other applicants.\n\nReady?`,
          { reply_markup: { inline_keyboard: [[
            { text: "Yes, let's go! ✅", callback_data: 'start_yes' },
            { text: "What is this?", callback_data: 'start_info' },
          ]] } }
        );
      } else {
        await sendMessage(BOT_TOKEN, chatId, "Hi! Please use the screening link shared by your landlord to get started. 🏠");
      }
      return new Response('OK');
    }

    // Photo for ID check
    if (photo && applicant.stage === 'id_check') {
      await handleIdUpload(supabase, BOT_TOKEN, chatId, applicant, photo);
      return new Response('OK');
    }

    // Text-based flow
    await handleTextMessage(supabase, BOT_TOKEN, chatId, applicant, text);
    return new Response('OK');

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('OK', { status: 200 });
  }
});

// ═══════════════════════════════════════════
// CALLBACK HANDLER
// ═══════════════════════════════════════════
async function handleCallback(
  supabase: any, token: string, chatId: number,
  telegramUserId: string, applicant: any, data: string
) {
  // Welcome stage callbacks
  if (data === 'start_yes') {
    await supabase.from('applicants').update({ stage: 'name' }).eq('id', applicant.id);
    await sendMessage(token, chatId, "Great! First, what's your full name?");
    return;
  }
  if (data === 'start_info') {
    await sendMessage(token, chatId,
      "FairKamer helps landlords find the best tenant match. I'll ask you a few quick questions about yourself, and the landlord will see a compatibility score. It's fair, fast, and transparent.\n\nReady to start?",
      { reply_markup: { inline_keyboard: [[ { text: "Yes, let's go! ✅", callback_data: 'start_yes' } ]] } }
    );
    return;
  }

  // Handle screening question callbacks
  for (const q of SCREENING_QUESTIONS) {
    const matchingOption = q.options.find(o => o.callback === data);
    if (matchingOption && applicant.stage === q.stage) {
      const updateData: any = { stage: q.nextStage };

      if (q.lifestyleKey) {
        const answers = applicant.lifestyle_answers || {};
        answers[q.lifestyleKey] = (q.valueMap as any)[data];
        // Also store income_range in lifestyle_answers for the income question
        updateData.lifestyle_answers = answers;
      } else {
        updateData[q.dbField] = (q.valueMap as any)[data];
      }

      // For income question, also store the numeric value and the range label
      if (q.id === 'income') {
        updateData.monthly_income = (q.valueMap as any)[data];
        const answers = applicant.lifestyle_answers || {};
        answers.income_range = (q.incomeRange as any)?.[data] || null;
        updateData.lifestyle_answers = answers;
      }

      await supabase.from('applicants').update(updateData).eq('id', applicant.id);

      // Send next question
      const nextQ = SCREENING_QUESTIONS.find(nq => nq.stage === q.nextStage);
      if (nextQ) {
        await sendMessage(token, chatId, nextQ.question, {
          reply_markup: {
            inline_keyboard: nextQ.options.map(o => [{ text: o.text, callback_data: o.callback }])
          }
        });
      } else if (q.nextStage === 'consent') {
        await sendMessage(token, chatId,
          "Thanks! One last thing — by continuing, you agree that your information may be used to verify your application in line with Dutch AVG/GDPR rules.\n\n✅ Type 'I agree' to continue."
        );
      }
      return;
    }
  }

  // Skip social
  if (data === 'skip_social') {
    await supabase.from('applicants').update({ stage: 'id_check' }).eq('id', applicant.id);
    await sendMessage(token, chatId,
      "No problem!\n\nLast step: please upload a photo of your ID (passport or Dutch ID card). This stays private and is only shared with the landlord. 🔒"
    );
    return;
  }

  // Viewing slot selection
  if (data.startsWith('slot_')) {
    const slotIndex = parseInt(data.replace('slot_', ''));
    const { data: property } = await supabase
      .from('landlord_properties').select('viewing_slots, address').eq('id', applicant.property_id).single();
    const slots = property?.viewing_slots || [];
    const selectedSlot = slots[slotIndex];
    if (selectedSlot) {
      await supabase.from('applicants')
        .update({ viewing_booked_at: selectedSlot.datetime, stage: 'done' })
        .eq('id', applicant.id);
      await sendMessage(token, chatId,
        `Confirmed! ✅\n\nYou're booked for ${selectedSlot.label} at ${property?.address || 'the property'}.\n\nYou'll get a reminder 24 hours before. See you there! 🏠`
      );
      await runMatchScoring(supabase, applicant.id);
    }
    return;
  }
}

// ═══════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════
async function handleTextMessage(
  supabase: any, token: string, chatId: number, applicant: any, text: string
) {
  const stage = applicant.stage;

  if (stage === 'name') {
    await supabase.from('applicants').update({ full_name: text, stage: 'q_occupants' }).eq('id', applicant.id);
    const firstQ = SCREENING_QUESTIONS[0];
    await sendMessage(token, chatId, `Nice to meet you, ${text}! 🙂\n\n${firstQ.question}`, {
      reply_markup: {
        inline_keyboard: firstQ.options.map(o => [{ text: o.text, callback_data: o.callback }])
      }
    });
    return;
  }

  if (stage === 'consent') {
    if (text.toLowerCase().includes('agree')) {
      await supabase.from('applicants').update({ consent_given: true, stage: 'socials' }).eq('id', applicant.id);
      await sendMessage(token, chatId,
        "Almost done! Sharing your Instagram helps landlords get a better picture of who you are. It's optional but recommended.\n\nYour Instagram handle? (e.g. @yourname)",
        { reply_markup: { inline_keyboard: [[ { text: "Skip ⏭️", callback_data: 'skip_social' } ]] } }
      );
    } else {
      await sendMessage(token, chatId, "Please type 'I agree' to continue, or ask me if you have questions about how your data is used.");
    }
    return;
  }

  if (stage === 'socials') {
    const handle = text.replace('@', '').trim();
    await supabase.from('applicants').update({ social_handle: handle, stage: 'id_check' }).eq('id', applicant.id);
    await sendMessage(token, chatId,
      `Got it! @${handle} noted. 📸\n\nLast step: please upload a photo of your ID (passport or Dutch ID card). This stays private and is only shared with the landlord. 🔒`
    );
    return;
  }

  if (stage === 'done') {
    await sendMessage(token, chatId,
      `Thanks ${applicant.full_name || ''}! The landlord will review your profile. If you have any questions before the viewing, just message me here. 😊`
    );
    return;
  }

  await sendMessage(token, chatId, "Please use the buttons above to answer, or type your response. 😊");
}

// ═══════════════════════════════════════════
// ID UPLOAD
// ═══════════════════════════════════════════
async function handleIdUpload(
  supabase: any, token: string, chatId: number, applicant: any, photos: any[]
) {
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
    console.error('Storage upload error:', uploadError);
    await sendMessage(token, chatId, "Sorry, there was an issue uploading your ID. Please try again.");
    return;
  }

  await supabase.from('applicants').update({ id_verified: true, id_document_url: storagePath, stage: 'scheduling' }).eq('id', applicant.id);
  await sendMessage(token, chatId, "Got it! Your ID is securely stored. ✅");

  const { data: property } = await supabase
    .from('landlord_properties').select('viewing_slots, address').eq('id', applicant.property_id).single();
  const slots = property?.viewing_slots || [];

  if (slots.length === 0) {
    await supabase.from('applicants').update({ stage: 'done' }).eq('id', applicant.id);
    await sendMessage(token, chatId,
      "You're all set! 🎉\n\nThe landlord hasn't added viewing slots yet, but they'll contact you once available. Thanks for completing the screening!"
    );
    await runMatchScoring(supabase, applicant.id);
  } else {
    const buttons = slots.map((slot: any, i: number) => [{ text: slot.label, callback_data: `slot_${i}` }]);
    await sendMessage(token, chatId, "You're all set! Here are the available viewing slots:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }
}

// ═══════════════════════════════════════════
// MATCH SCORING
// ═══════════════════════════════════════════
async function runMatchScoring(supabase: any, applicantId: string) {
  const { data: applicant } = await supabase.from('applicants').select('*').eq('id', applicantId).single();
  if (!applicant) return;

  const { data: property } = await supabase
    .from('landlord_properties').select('rent_amount').eq('id', applicant.property_id).single();
  if (!property) return;

  const { data: criteria } = await supabase
    .from('landlord_criteria').select('*').eq('property_id', applicant.property_id).maybeSingle();

  const rent = property.rent_amount || 1000;
  const scrapeData = {
    ...(applicant.scrape_linkedin ? { linkedin: applicant.scrape_linkedin } : {}),
    ...(applicant.scrape_kvk ? { kvk: applicant.scrape_kvk } : {}),
    ...(applicant.scrape_google ? { google: applicant.scrape_google } : {}),
  };

  const result = calculateMatchScore(applicant, criteria, rent, Object.keys(scrapeData).length > 0 ? scrapeData : null);

  await supabase.from('applicants').update({
    match_score: Math.round(result.score * 10), // Store as 0-100 int for backward compat, divide by 10 in UI
    match_label: result.label,
    match_flags: result.flags,
    hard_disqualified: result.hardDisqualified,
    hard_disqualify_reason: result.hardDisqualifyReason,
  }).eq('id', applicantId);
}

// ═══════════════════════════════════════════
// TELEGRAM HELPERS
// ═══════════════════════════════════════════
async function sendMessage(token: string, chatId: number, text: string, extra?: any) {
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}
