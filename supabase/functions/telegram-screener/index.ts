import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_API = 'https://api.telegram.org/bot';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

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
    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat.id;
    const text = message.text?.trim() || '';
    const telegramUserId = String(message.from.id);

    // Check for photo (ID upload)
    const photo = message.photo;

    // Look up existing applicant by telegram_user_id
    const { data: applicant } = await supabase
      .from('applicants')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    if (!applicant) {
      // New user — check if they started with a deep link /start <property_id>
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const propertyId = parts[1];

        if (!propertyId) {
          await sendMessage(BOT_TOKEN, chatId, "Welcome! Please use the screening link shared by your landlord to get started.");
          return new Response('OK');
        }

        // Verify property exists
        const { data: property } = await supabase
          .from('landlord_properties')
          .select('id, address, landlord_id')
          .eq('id', propertyId)
          .maybeSingle();

        if (!property) {
          await sendMessage(BOT_TOKEN, chatId, "Sorry, that property link doesn't seem valid. Please check with your landlord.");
          return new Response('OK');
        }

        // Get landlord name
        const { data: landlord } = await supabase
          .from('landlords')
          .select('full_name')
          .eq('id', property.landlord_id)
          .maybeSingle();

        // Create applicant record
        await supabase.from('applicants').insert({
          telegram_user_id: telegramUserId,
          property_id: propertyId,
          stage: 'welcome',
        });

        const landlordName = landlord?.full_name || 'your landlord';
        await sendMessage(BOT_TOKEN, chatId,
          `Hey! 👋 I'm the FairKamer assistant for ${landlordName}.\n\n` +
          `I help match tenants with the right home. It takes about 5 minutes ` +
          `and helps you stand out from other applicants.\n\nReady?`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "Yes, let's go! ✅", callback_data: 'start_yes' },
                { text: "What is this?", callback_data: 'start_info' },
              ]]
            }
          }
        );
      } else {
        await sendMessage(BOT_TOKEN, chatId, "Hi! Please use the screening link shared by your landlord to get started. 🏠");
      }
      return new Response('OK');
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const cbChatId = update.callback_query.message.chat.id;
      await handleCallback(supabase, BOT_TOKEN, cbChatId, telegramUserId, applicant, callbackData);
      // Answer the callback to remove loading state
      await fetch(`${TELEGRAM_API}${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
      return new Response('OK');
    }

    // Handle photo upload for ID check stage
    if (photo && applicant.stage === 'id_check') {
      await handleIdUpload(supabase, BOT_TOKEN, chatId, applicant, photo, message);
      return new Response('OK');
    }

    // Handle text-based conversation flow
    await handleTextMessage(supabase, BOT_TOKEN, chatId, applicant, text);

    return new Response('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('OK', { status: 200 }); // Always return 200 to Telegram
  }
});

// Also handle callback_query at top level
Deno.serve; // Already defined above, this is handled inline

async function handleCallback(
  supabase: any, token: string, chatId: number,
  telegramUserId: string, applicant: any, data: string
) {
  if (data === 'start_yes') {
    await supabase.from('applicants')
      .update({ stage: 'name' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "Great! First, a few basics.\n\nWhat's your full name?");
  } else if (data === 'start_info') {
    await sendMessage(token, chatId,
      "FairKamer helps landlords find the best tenant match. " +
      "I'll ask you a few quick questions about yourself, and the landlord " +
      "will see a compatibility score. It's fair, fast, and transparent.\n\n" +
      "Ready to start?",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Yes, let's go! ✅", callback_data: 'start_yes' },
          ]]
        }
      }
    );
  } else if (data.startsWith('age_')) {
    const ageMap: Record<string, number> = { 'age_18': 20, 'age_23': 25, 'age_28': 31, 'age_36': 40 };
    await supabase.from('applicants')
      .update({ age: ageMap[data] || 25, stage: 'occupation' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "What do you do?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎓 Student", callback_data: 'occ_student' }],
          [{ text: "💼 Working professional", callback_data: 'occ_professional' }],
          [{ text: "🏢 Self-employed", callback_data: 'occ_selfemployed' }],
          [{ text: "Other", callback_data: 'occ_other' }],
        ]
      }
    });
  } else if (data.startsWith('occ_')) {
    const occMap: Record<string, string> = {
      'occ_student': 'Student', 'occ_professional': 'Working professional',
      'occ_selfemployed': 'Self-employed', 'occ_other': 'Other'
    };
    await supabase.from('applicants')
      .update({ occupation: occMap[data] || 'Other', stage: 'income' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "What's your monthly income (before tax)?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Under €1,500", callback_data: 'inc_1500' }],
          [{ text: "€1,500 – €2,500", callback_data: 'inc_2500' }],
          [{ text: "€2,500 – €3,500", callback_data: 'inc_3500' }],
          [{ text: "€3,500+", callback_data: 'inc_4000' }],
        ]
      }
    });
  } else if (data.startsWith('inc_')) {
    const incMap: Record<string, number> = {
      'inc_1500': 1200, 'inc_2500': 2000, 'inc_3500': 3000, 'inc_4000': 4000
    };
    await supabase.from('applicants')
      .update({ monthly_income: incMap[data] || 2000, stage: 'smoking' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "Nice! Now a few lifestyle questions so we can find the best match.\n\nDo you smoke?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "No 🚭", callback_data: 'smoke_no' }],
          [{ text: "Socially", callback_data: 'smoke_social' }],
          [{ text: "Yes, regularly", callback_data: 'smoke_yes' }],
        ]
      }
    });
  } else if (data.startsWith('smoke_')) {
    const answers = applicant.lifestyle_answers || {};
    answers.smoking = data.replace('smoke_', '');
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'pets' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "Any pets?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "No pets", callback_data: 'pets_none' }],
          [{ text: "🐱 Cat", callback_data: 'pets_cat' }],
          [{ text: "🐶 Dog", callback_data: 'pets_dog' }],
          [{ text: "Other", callback_data: 'pets_other' }],
        ]
      }
    });
  } else if (data.startsWith('pets_')) {
    const answers = applicant.lifestyle_answers || {};
    answers.pets = data.replace('pets_', '');
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'lifestyle' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "How would you describe your lifestyle?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏡 Quiet homebody", callback_data: 'life_quiet' }],
          [{ text: "😊 Social but chill", callback_data: 'life_chill' }],
          [{ text: "🎉 Active social life", callback_data: 'life_active' }],
          [{ text: "🎊 Party lover", callback_data: 'life_party' }],
        ]
      }
    });
  } else if (data.startsWith('life_')) {
    const answers = applicant.lifestyle_answers || {};
    answers.lifestyle = data.replace('life_', '');
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'bedtime' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "What time do you usually go to bed?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Before 22:00", callback_data: 'bed_early' }],
          [{ text: "22:00 – 00:00", callback_data: 'bed_normal' }],
          [{ text: "After midnight 🌙", callback_data: 'bed_late' }],
        ]
      }
    });
  } else if (data.startsWith('bed_')) {
    const answers = applicant.lifestyle_answers || {};
    answers.bedtime = data.replace('bed_', '');
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'guests' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "How do you feel about having guests over?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Rarely", callback_data: 'guest_rare' }],
          [{ text: "Sometimes on weekends", callback_data: 'guest_sometimes' }],
          [{ text: "Often", callback_data: 'guest_often' }],
        ]
      }
    });
  } else if (data.startsWith('guest_')) {
    const answers = applicant.lifestyle_answers || {};
    answers.guests = data.replace('guest_', '');
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'extra_notes' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, "Anything else you'd like the landlord to know about you? Just type it, or send \"Skip\" to continue.");
  } else if (data === 'skip_social') {
    await supabase.from('applicants')
      .update({ stage: 'id_check' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId,
      "No problem!\n\nLast step: please upload a photo of your ID (passport or Dutch ID card). " +
      "This stays private and is only shared with the landlord. 🔒"
    );
  } else if (data.startsWith('slot_')) {
    const slotIndex = parseInt(data.replace('slot_', ''));
    // Get property viewing slots
    const { data: property } = await supabase
      .from('landlord_properties')
      .select('viewing_slots, address')
      .eq('id', applicant.property_id)
      .single();
    
    const slots = property?.viewing_slots || [];
    const selectedSlot = slots[slotIndex];
    
    if (selectedSlot) {
      await supabase.from('applicants')
        .update({ viewing_booked_at: selectedSlot.datetime, stage: 'done' })
        .eq('id', applicant.id);
      
      await sendMessage(token, chatId,
        `Confirmed! ✅\n\nYou're booked for ${selectedSlot.label} at ${property?.address || 'the property'}.\n\n` +
        `You'll get a reminder 24 hours before. See you there! 🏠`
      );

      // Trigger match score calculation
      await calculateAndStoreMatchScore(supabase, applicant.id);
    }
  }
}

async function handleTextMessage(
  supabase: any, token: string, chatId: number, applicant: any, text: string
) {
  const stage = applicant.stage;

  if (stage === 'name') {
    await supabase.from('applicants')
      .update({ full_name: text, stage: 'age' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId, `Nice to meet you, ${text}! How old are you?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "18–22", callback_data: 'age_18' }],
          [{ text: "23–27", callback_data: 'age_23' }],
          [{ text: "28–35", callback_data: 'age_28' }],
          [{ text: "36+", callback_data: 'age_36' }],
        ]
      }
    });
  } else if (stage === 'extra_notes') {
    const answers = applicant.lifestyle_answers || {};
    answers.extra_notes = text === 'Skip' ? '' : text;
    await supabase.from('applicants')
      .update({ lifestyle_answers: answers, stage: 'socials' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId,
      "Almost done! Sharing your Instagram helps landlords get a better picture of who you are. It's optional but recommended.\n\n" +
      "Your Instagram handle? (e.g. @yourname)",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "Skip ⏭️", callback_data: 'skip_social' },
          ]]
        }
      }
    );
  } else if (stage === 'socials') {
    const handle = text.replace('@', '').trim();
    await supabase.from('applicants')
      .update({ social_handle: handle, stage: 'id_check' })
      .eq('id', applicant.id);
    await sendMessage(token, chatId,
      `Got it! @${handle} noted. 📸\n\n` +
      "Last step: please upload a photo of your ID (passport or Dutch ID card). " +
      "This stays private and is only shared with the landlord. 🔒"
    );
  } else if (stage === 'done') {
    await sendMessage(token, chatId,
      `Thanks ${applicant.full_name || ''}! The landlord will review your profile. ` +
      "If you have any questions before the viewing, just message me here. 😊"
    );
  } else {
    await sendMessage(token, chatId, "Please use the buttons above to answer, or type your response. 😊");
  }
}

async function handleIdUpload(
  supabase: any, token: string, chatId: number, applicant: any, photos: any[], message: any
) {
  // Get the highest resolution photo
  const photo = photos[photos.length - 1];
  const fileId = photo.file_id;

  // Download file from Telegram
  const BOT_TOKEN = Deno.env.get('TELEGRAM_SCREENER_TOKEN')!;
  const fileInfoRes = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  const filePath = fileInfo.result.file_path;

  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  const fileBytes = await fileRes.arrayBuffer();

  // Upload to Supabase Storage
  const storagePath = `${applicant.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('id-documents')
    .upload(storagePath, fileBytes, { contentType: 'image/jpeg' });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    await sendMessage(token, chatId, "Sorry, there was an issue uploading your ID. Please try again.");
    return;
  }

  await supabase.from('applicants')
    .update({
      id_verified: true,
      id_document_url: storagePath,
      stage: 'scheduling',
    })
    .eq('id', applicant.id);

  await sendMessage(token, chatId, "Got it! Your ID is securely stored. ✅");

  // Show available viewing slots
  const { data: property } = await supabase
    .from('landlord_properties')
    .select('viewing_slots, address')
    .eq('id', applicant.property_id)
    .single();

  const slots = property?.viewing_slots || [];

  if (slots.length === 0) {
    await supabase.from('applicants')
      .update({ stage: 'done' })
      .eq('id', applicant.id);

    await sendMessage(token, chatId,
      "You're all set! 🎉\n\nThe landlord hasn't added viewing slots yet, " +
      "but they'll contact you once available. Thanks for completing the screening!"
    );
    await calculateAndStoreMatchScore(supabase, applicant.id);
  } else {
    const buttons = slots.map((slot: any, i: number) => ([
      { text: slot.label, callback_data: `slot_${i}` }
    ]));
    await sendMessage(token, chatId, "You're all set! Here are the available viewing slots:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }
}

async function calculateAndStoreMatchScore(supabase: any, applicantId: string) {
  const { data: applicant } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .single();

  if (!applicant) return;

  // Get property rent
  const { data: property } = await supabase
    .from('landlord_properties')
    .select('rent_amount, landlord_id')
    .eq('id', applicant.property_id)
    .single();

  if (!property) return;

  // Get landlord criteria
  const { data: criteria } = await supabase
    .from('landlord_criteria')
    .select('*')
    .eq('property_id', applicant.property_id)
    .maybeSingle();

  const rent = property.rent_amount || 1000;
  const answers = applicant.lifestyle_answers || {};
  let score = 0;
  const flags: string[] = [];

  // FINANCIAL FITNESS (40 points)
  const income = applicant.monthly_income || 0;
  const ratio = income / rent;
  if (ratio >= 4) score += 40;
  else if (ratio >= 3) score += 30;
  else if (ratio >= 2.5) score += 20;
  else if (ratio >= 2) score += 10;
  else flags.push("Income below 2x rent");

  // ID verification baseline
  if (!applicant.id_verified) flags.push("ID not yet verified");

  // LIFESTYLE MATCH (35 points)
  let lifestyleScore = 35;
  if (criteria) {
    if (criteria.smoking_allowed === false && answers.smoking !== 'no') {
      lifestyleScore -= 15;
      flags.push("Smoker — landlord prefers non-smoker");
    }
    if (criteria.pets_allowed === false && answers.pets !== 'none') {
      lifestyleScore -= 10;
      flags.push("Has pets — landlord does not allow pets");
    }
    if (criteria.preferred_gender && criteria.preferred_gender !== 'any') {
      // Can't reliably determine gender from questionnaire, skip
    }
    if (answers.lifestyle === 'party' && criteria.notes?.toLowerCase().includes('quiet')) {
      lifestyleScore -= 10;
      flags.push("Active social lifestyle — landlord prefers quiet tenants");
    }
  }
  score += Math.max(0, lifestyleScore);

  // SOCIAL SIGNALS (15 points) — neutral without Apify
  score += 8;

  // RELIABILITY (10 points)
  if (applicant.id_verified) score += 3;
  score += 5; // completed all questions
  score += 2; // responded

  const finalScore = Math.min(100, Math.max(0, score));

  await supabase.from('applicants')
    .update({ match_score: finalScore, match_flags: flags })
    .eq('id', applicantId);
}

async function sendMessage(token: string, chatId: number, text: string, extra?: any) {
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    }),
  });
}
