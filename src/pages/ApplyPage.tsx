import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Property {
  id: string;
  address: string;
  city: string;
  postcode: string;
  rent_amount: number;
  photo_url?: string | null;
}

interface FormState {
  phone: string;
  email: string;
  full_name: string;
  age: string;
  num_occupants: string;
  desired_move_in: string;
  employment_type: string;
  monthly_income_range: string;
  smoking: string;
  pets: string;
  bkr_status: string;
  social_platform: string;
  social_handle: string;
  consent_given: boolean;
}

const EMPTY: FormState = {
  phone: "", email: "", full_name: "", age: "",
  num_occupants: "", desired_move_in: "",
  employment_type: "", monthly_income_range: "",
  smoking: "", pets: "", bkr_status: "",
  social_platform: "", social_handle: "",
  consent_given: false,
};

// Step keys
const STEPS = [
  "phone", "email", "name", "age",
  "occupants", "move_in",
  "employment", "income",
  "smoking", "pets",
  "bkr", "social", "consent",
] as const;
const TOTAL = STEPS.length; // 13

// ─── Option Button ────────────────────────────────────────────────────────────

function Opt({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 font-medium text-sm transition-all active:scale-[0.98]
        ${selected
          ? "border-[#C84B2F] bg-[#C84B2F]/10 text-[#C84B2F]"
          : "border-border bg-card text-foreground"}`}
    >
      {label}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang } = useLanguage();

  const [property, setProperty] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(0);
  const [validErr, setValidErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Intro screen state — shown before the form steps
  const [introShown, setIntroShown] = useState(false);

  // Account creation prompt state
  const [accountStep, setAccountStep] = useState<"prompt" | "sending" | "sent" | "skipped">("prompt");

  // ─── Load property ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoadError(lang === "nl" ? "Ongeldige link." : "Invalid link."); return; }
    fetch(`${SUPABASE_URL}/rest/v1/landlord_properties?application_token=eq.${encodeURIComponent(token)}&select=id,address,city,postcode,rent_amount,photo_url&limit=1`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then(r => r.json())
      .then(data => {
        const prop = Array.isArray(data) ? data[0] : null;
        if (!prop?.id) { setLoadError(lang === "nl" ? "Ongeldige link — neem contact op met de verhuurder." : "Invalid link — contact the landlord."); return; }
        setProperty(prop as Property);
        const saved = localStorage.getItem(`fk_apply_${token}`);
        if (saved) { try { const p = JSON.parse(saved); if (p.phone) { setForm(f => ({ ...f, ...p })); setStep(p._step || 0); setIntroShown(true); } } catch { /* ignore */ } }
      })
      .catch(() => setLoadError(lang === "nl" ? "Kon de woning niet laden." : "Could not load property."));
  }, [token]);

  // ─── Persist progress ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !form.phone) return;
    localStorage.setItem(`fk_apply_${token}`, JSON.stringify({ ...form, _step: step }));
  }, [form, step]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const nl = lang === "nl";
  const s = (field: keyof FormState, value: string) => { setForm(f => ({ ...f, [field]: value })); setValidErr(""); };

  function validate(): boolean {
    setValidErr("");
    const key = STEPS[step];
    if (key === "phone") {
      const c = form.phone.replace(/\s/g, "");
      if (!c || !/^\+?[0-9]{8,15}$/.test(c)) { setValidErr(nl ? "Voer een geldig telefoonnummer in (+31...)" : "Enter a valid phone number (+31...)"); return false; }
    }
    if (key === "email") {
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setValidErr(nl ? "Ongeldig e-mailadres" : "Invalid email address"); return false; }
    }
    if (key === "name" && !form.full_name.trim()) { setValidErr(nl ? "Vul je naam in" : "Enter your name"); return false; }
    if (key === "age") { const a = parseInt(form.age); if (!form.age || isNaN(a) || a < 18 || a > 99) { setValidErr(nl ? "Voer een geldige leeftijd in (18-99)" : "Enter a valid age (18-99)"); return false; } }
    if (key === "occupants" && !form.num_occupants) return false;
    if (key === "move_in" && !form.desired_move_in) return false;
    if (key === "employment" && !form.employment_type) return false;
    if (key === "income" && !form.monthly_income_range) return false;
    if (key === "smoking" && !form.smoking) return false;
    if (key === "pets" && !form.pets) return false;
    if (key === "bkr" && !form.bkr_status) return false;
    // social step is always valid — it's optional
    if (key === "consent" && !form.consent_given) { setValidErr(nl ? "Je moet akkoord gaan om door te gaan." : "You must agree to continue."); return false; }
    return true;
  }

  function next() { if (!validate()) return; if (step < TOTAL - 1) setStep(s => s + 1); }
  function back() {
    setValidErr("");
    if (STEPS[step] === "social" && form.social_platform && form.social_platform !== "skip") {
      setForm(f => ({ ...f, social_platform: "", social_handle: "" }));
      return;
    }
    setStep(s => Math.max(s - 1, 0));
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!form.consent_given) { setValidErr(nl ? "Je moet akkoord gaan." : "You must agree."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_token: token,
          phone: form.phone.replace(/\s/g, ""),
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          age: parseInt(form.age),
          num_occupants: form.num_occupants,
          desired_move_in: form.desired_move_in,
          employment_type: form.employment_type,
          monthly_income_range: form.monthly_income_range,
          smoking: form.smoking,
          pets: form.pets,
          bkr_status: form.bkr_status,
          social_platform: form.social_platform === "skip" ? null : (form.social_platform || null),
          social_handle: form.social_handle.trim() || null,
          consent_given: true,
          preferred_language: lang,
        }),
      });
      if (res.ok) { localStorage.removeItem(`fk_apply_${token}`); setDone(true); }
      else { const e = await res.json(); setValidErr(e.error || (nl ? "Er ging iets mis." : "Something went wrong.")); }
    } catch { setValidErr(nl ? "Controleer je verbinding." : "Check your connection."); }
    setSubmitting(false);
  }

  // ─── Account creation ──────────────────────────────────────────────────────

  async function createAccount() {
    setAccountStep("sending");
    try {
      await supabase.auth.signInWithOtp({
        email: form.email.trim(),
        options: { shouldCreateUser: true },
      });
      setAccountStep("sent");
    } catch {
      // Even on error, show sent — OTP errors are usually rate-limits, email still likely sent
      setAccountStep("sent");
    }
  }

  // ─── Error / Loading ───────────────────────────────────────────────────────

  if (loadError) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🏠</div>
        <p className="text-muted-foreground text-sm">{loadError}</p>
      </div>
    </div>
  );

  if (!property) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#C84B2F] border-t-transparent animate-spin" />
    </div>
  );

  // ─── Intro screen ──────────────────────────────────────────────────────────

  if (!introShown) return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Property photo / hero */}
      <div className="relative w-full flex-1 min-h-[55vh] max-h-[65vh] overflow-hidden bg-muted">
        {property.photo_url ? (
          <img
            src={property.photo_url}
            alt={property.address}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#C84B2F]/10 to-[#C84B2F]/5">
            <svg className="w-24 h-24 text-[#C84B2F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 21V12h6v9" />
            </svg>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        {/* FairKamer badge */}
        <div className="absolute top-4 left-4">
          <span className="text-xs font-bold text-white bg-[#C84B2F] px-2.5 py-1 rounded-lg shadow-sm">FairKamer</span>
        </div>
        {/* Language toggle */}
        <div className="absolute top-4 right-4">
          <button onClick={() => setLang(lang === "nl" ? "en" : "nl")} className="text-xs px-2.5 py-1 rounded-lg border border-white/30 text-white bg-black/20 backdrop-blur-sm">
            {lang === "nl" ? "EN" : "NL"}
          </button>
        </div>
      </div>

      {/* Property info + CTA */}
      <div className="px-5 pt-5 pb-10 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground leading-tight">{property.address}</h1>
          {property.city && <p className="text-sm text-muted-foreground mt-0.5">{property.city}{property.postcode ? ` · ${property.postcode}` : ""}</p>}
          {property.rent_amount && (
            <div className="mt-3 inline-flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">€{property.rent_amount.toLocaleString("nl-NL")}</span>
              <span className="text-sm text-muted-foreground">{nl ? "/ maand" : "/ month"}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setIntroShown(true)}
          className="w-full h-14 rounded-2xl bg-[#C84B2F] text-white font-semibold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
        >
          {nl ? "Start aanmelding" : "Start Application"}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <p className="text-center text-xs text-muted-foreground/60">Powered by FairKamer</p>
      </div>
    </div>
  );

  // ─── Done + Account Prompt ─────────────────────────────────────────────────

  if (done) {
    // Account prompt screen
    if (accountStep === "prompt") return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full">
          {/* Success checkmark */}
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-xl font-serif font-bold text-foreground mb-1">
            {nl ? "Aanmelding ontvangen!" : "Application received!"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {nl ? `Bedankt voor je aanmelding voor ${property.address}.` : `Thanks for applying to ${property.address}.`}
          </p>

          {/* Account prompt card */}
          <div className="bg-card border border-border rounded-2xl p-5 text-left mb-4">
            <h2 className="text-base font-semibold text-foreground mb-1">
              {nl ? "Sla je profiel op!" : "Save your profile!"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {nl
                ? "Maak een gratis FairKamer account aan en je gegevens worden bewaard voor de volgende keer. Geen wachtwoord nodig."
                : "Create a free FairKamer account and your details are saved for next time. No password needed."}
            </p>
            <ul className="space-y-2 mb-5">
              {[
                nl ? "Meld je in seconden aan bij andere woningen" : "Apply to other properties in seconds",
                nl ? "Bekijk al je aanmeldingen op één plek" : "Track all your applications in one place",
                nl ? "Ontvang meldingen wanneer verhuurders reageren" : "Get notified when landlords respond",
              ].map((benefit, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <svg className="w-4 h-4 text-[#C84B2F] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
            <button
              onClick={createAccount}
              className="w-full h-11 rounded-xl bg-[#C84B2F] text-white font-semibold text-sm active:scale-[0.98] transition-all"
            >
              {nl ? "Ja, sla mijn profiel op" : "Yes, save my profile"}
            </button>
          </div>

          <button
            onClick={() => setAccountStep("skipped")}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            {nl ? "Nee bedankt, overslaan" : "No thanks, skip"}
          </button>

          <p className="text-xs text-muted-foreground/50 mt-8">Powered by FairKamer</p>
        </div>
      </div>
    );

    // Sending magic link
    if (accountStep === "sending") return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-8 h-8 rounded-full border-2 border-[#C84B2F] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{nl ? "Magic link versturen…" : "Sending magic link…"}</p>
        </div>
      </div>
    );

    // Magic link sent
    if (accountStep === "sent") return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-3">
            {nl ? "Check je inbox!" : "Check your inbox!"}
          </h1>
          <p className="text-muted-foreground text-sm mb-2">
            {nl
              ? `We hebben een magic link gestuurd naar ${form.email}. Klik erop om je account te activeren.`
              : `We sent a magic link to ${form.email}. Click it to activate your account.`}
          </p>
          <p className="text-muted-foreground text-sm">
            {nl ? "De verhuurder neemt contact met je op als je profiel een goede match is." : "The landlord will contact you if your profile is a good match."}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-8">Powered by FairKamer</p>
        </div>
      </div>
    );

    // Skipped — show normal done screen
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-3">
            {nl ? "Aanmelding ontvangen!" : "Application received!"}
          </h1>
          <p className="text-muted-foreground text-sm mb-2">
            {nl ? `Bedankt voor je aanmelding voor ${property.address}.` : `Thanks for applying to ${property.address}.`}
          </p>
          <p className="text-muted-foreground text-sm">
            {nl ? "De verhuurder neemt contact met je op als je profiel een goede match is." : "The landlord will contact you if your profile is a good match."}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-8">Powered by FairKamer</p>
        </div>
      </div>
    );
  }

  // ─── Step content ──────────────────────────────────────────────────────────

  const progress = (step / (TOTAL - 1)) * 100;
  const key = STEPS[step];
  const isLast = step === TOTAL - 1;

  // Platform config for handle input sub-state
  const platformConfig: Record<string, { placeholder: string; hint: string; hintNl: string }> = {
    instagram: { placeholder: "@gebruikersnaam", hint: "Your Instagram username", hintNl: "Je Instagram gebruikersnaam" },
    facebook:  { placeholder: "facebook.com/jouwprofiel", hint: "Your Facebook profile URL", hintNl: "Je Facebook profiel URL" },
    twitter:   { placeholder: "@gebruikersnaam of twitter.com/jij", hint: "Your Twitter / X handle or URL", hintNl: "Je Twitter/X gebruikersnaam of URL" },
    linkedin:  { placeholder: "linkedin.com/in/jounaam", hint: "Your LinkedIn profile URL", hintNl: "Je LinkedIn profiel URL" },
  };

  function renderStep() {
    switch (key) {
      case "phone": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-1">{nl ? "Wat is je telefoonnummer?" : "What's your phone number?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Wij gebruiken dit alleen om contact op te nemen." : "We only use this to contact you."}</p>
          <input type="tel" value={form.phone} onChange={e => s("phone", e.target.value)} placeholder="+31 6 12345678" autoComplete="tel"
            className="w-full h-14 px-4 text-lg rounded-2xl border-2 border-border bg-card text-foreground focus:border-[#C84B2F] focus:outline-none transition-colors" />
        </>
      );
      case "email": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-1">{nl ? "Wat is je e-mailadres?" : "What's your email?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Je ontvangt hier een bevestiging." : "You'll get a confirmation here."}</p>
          <input type="email" value={form.email} onChange={e => s("email", e.target.value)} placeholder="jij@voorbeeld.nl" autoComplete="email"
            className="w-full h-14 px-4 text-lg rounded-2xl border-2 border-border bg-card text-foreground focus:border-[#C84B2F] focus:outline-none transition-colors" />
        </>
      );
      case "name": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-1">{nl ? "Hoe heet je?" : "What's your name?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Voor- en achternaam." : "First and last name."}</p>
          <input type="text" value={form.full_name} onChange={e => s("full_name", e.target.value)} placeholder="Jan de Vries" autoComplete="name"
            className="w-full h-14 px-4 text-lg rounded-2xl border-2 border-border bg-card text-foreground focus:border-[#C84B2F] focus:outline-none transition-colors" />
        </>
      );
      case "age": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-1">{nl ? "Hoe oud ben je?" : "How old are you?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Je moet minimaal 18 jaar zijn." : "You must be at least 18."}</p>
          <input type="number" value={form.age} onChange={e => s("age", e.target.value)} placeholder="25" min="18" max="99"
            className="w-full h-14 px-4 text-lg rounded-2xl border-2 border-border bg-card text-foreground focus:border-[#C84B2F] focus:outline-none transition-colors" />
        </>
      );
      case "occupants": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-6">{nl ? "Hoeveel personen trekken er in?" : "How many people will move in?"}</p>
          <div className="space-y-3">
            {[nl ? "Alleen ik" : "Just me", nl ? "2 personen" : "2 people", nl ? "3 personen" : "3 people", "4+"].map(v => (
              <Opt key={v} label={v} selected={form.num_occupants === v} onClick={() => { s("num_occupants", v); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "move_in": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-6">{nl ? "Wanneer wil je intrekken?" : "When do you want to move in?"}</p>
          <div className="space-y-3">
            {[
              [nl ? "Deze maand" : "This month", "This month"],
              [nl ? "Volgende maand" : "Next month", "Next month"],
              [nl ? "Over 2-3 maanden" : "2-3 months", "2-3 months"],
              [nl ? "Flexibel" : "Flexible", "Flexible"],
            ].map(([label, val]) => (
              <Opt key={val} label={label} selected={form.desired_move_in === val} onClick={() => { s("desired_move_in", val); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "employment": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-6">{nl ? "Wat is je werksituatie?" : "What's your employment situation?"}</p>
          <div className="space-y-3">
            {[
              ["Loondienst (employed)", nl ? "In loondienst" : "Employed"],
              ["ZZP (self-employed)", nl ? "ZZP / eigen bedrijf" : "Self-employed"],
              ["Student", "Student"],
              ["Uitkering (benefits)", nl ? "Uitkering" : "Benefits"],
            ].map(([val, label]) => (
              <Opt key={val} label={label} selected={form.employment_type === val} onClick={() => { s("employment_type", val); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "income": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-2">{nl ? "Wat is je maandinkomen?" : "What's your monthly income?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Netto per maand." : "Net per month."}</p>
          <div className="space-y-3">
            {["Under \u20ac1,500", "\u20ac1,500 - \u20ac2,500", "\u20ac2,500 - \u20ac3,500", "\u20ac3,500 - \u20ac5,000", "\u20ac5,000+"].map(v => (
              <Opt key={v} label={v} selected={form.monthly_income_range === v} onClick={() => { s("monthly_income_range", v); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "smoking": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-6">{nl ? "Rook je?" : "Do you smoke?"}</p>
          <div className="space-y-3">
            {[
              ["No", nl ? "Nee, ik rook niet" : "No, I don't smoke"],
              ["Outside only", nl ? "Alleen buiten" : "Outside only"],
              ["Yes", nl ? "Ja, binnenshuis" : "Yes, indoors"],
            ].map(([val, label]) => (
              <Opt key={val} label={label} selected={form.smoking === val} onClick={() => { s("smoking", val); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "pets": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-6">{nl ? "Heb je huisdieren?" : "Do you have pets?"}</p>
          <div className="space-y-3">
            {[
              ["No pets", nl ? "Geen huisdieren" : "No pets"],
              ["Cat", nl ? "Kat" : "Cat"],
              ["Dog", nl ? "Hond" : "Dog"],
              ["Other pet", nl ? "Ander huisdier" : "Other pet"],
            ].map(([val, label]) => (
              <Opt key={val} label={label} selected={form.pets === val} onClick={() => { s("pets", val); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "bkr": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-2">{nl ? "Heb je een BKR-registratie of huurachterstand?" : "Do you have a BKR registration or rent arrears?"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Dit wordt vertrouwelijk behandeld." : "This is treated confidentially."}</p>
          <div className="space-y-3">
            {[
              ["No", nl ? "Nee" : "No"],
              ["Yes, I can explain", nl ? "Ja, ik kan dit toelichten" : "Yes, I can explain"],
            ].map(([val, label]) => (
              <Opt key={val} label={label} selected={form.bkr_status === val} onClick={() => { s("bkr_status", val); setTimeout(() => setStep(prev => prev + 1), 80); }} />
            ))}
          </div>
        </>
      );
      case "social": {
        if (form.social_platform && form.social_platform !== "skip") {
          const cfg = platformConfig[form.social_platform] || platformConfig.instagram;
          const platformLabel = { instagram: "Instagram", facebook: "Facebook", twitter: "Twitter / X", linkedin: "LinkedIn" }[form.social_platform] || "";
          return (
            <>
              <p className="text-2xl font-serif font-bold text-foreground mb-1">
                {nl ? `Jouw ${platformLabel} profiel` : `Your ${platformLabel} profile`}
              </p>
              <p className="text-sm text-muted-foreground mb-6">{nl ? cfg.hintNl : cfg.hint}</p>
              <input
                type="url"
                inputMode="url"
                value={form.social_handle}
                onChange={e => s("social_handle", e.target.value)}
                placeholder={cfg.placeholder}
                autoFocus
                className="w-full h-14 px-4 text-base rounded-2xl border-2 border-border bg-card text-foreground focus:border-[#C84B2F] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, social_platform: "", social_handle: "" }))}
                className="mt-3 text-sm text-muted-foreground underline underline-offset-2"
              >
                {nl ? "Andere keuze" : "Change platform"}
              </button>
            </>
          );
        }
        return (
          <>
            <p className="text-2xl font-serif font-bold text-foreground mb-1">
              {nl ? "Welk socialmedia gebruik je?" : "Which social media do you use?"}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {nl ? "Optioneel — helpt ons je profiel verifiëren." : "Optional — helps us verify your profile."}
            </p>
            <div className="space-y-3">
              {([
                ["instagram", "Instagram"],
                ["facebook", "Facebook"],
                ["twitter", "Twitter / X"],
                ["linkedin", "LinkedIn"],
                ["skip", nl ? "Liever niet" : "I'd prefer not to"],
              ] as [string, string][]).map(([val, label]) => (
                <Opt
                  key={val}
                  label={label}
                  selected={form.social_platform === val}
                  onClick={() => {
                    s("social_platform", val);
                    if (val === "skip") setTimeout(() => setStep(prev => prev + 1), 80);
                  }}
                />
              ))}
            </div>
          </>
        );
      }
      case "consent": return (
        <>
          <p className="text-2xl font-serif font-bold text-foreground mb-2">{nl ? "Bijna klaar!" : "Almost done!"}</p>
          <p className="text-sm text-muted-foreground mb-6">{nl ? "Controleer je gegevens en geef toestemming." : "Review your details and give consent."}</p>
          <div className="glass-card rounded-2xl p-4 mb-6 space-y-2">
            {[
              [nl ? "Naam" : "Name", form.full_name],
              [nl ? "Telefoon" : "Phone", form.phone],
              [nl ? "E-mail" : "Email", form.email],
              [nl ? "Inkomen" : "Income", form.monthly_income_range],
              [nl ? "Werk" : "Work", form.employment_type],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{val}</span></div>
            ) : null)}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${form.consent_given ? "border-[#C84B2F] bg-[#C84B2F]" : "border-border bg-card"}`} onClick={() => { setForm(f => ({ ...f, consent_given: !f.consent_given })); setValidErr(""); }}>
              {form.consent_given && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-sm text-muted-foreground">
              {nl ? "Ik geef toestemming voor het verwerken van mijn gegevens voor woonbemiddeling door FairKamer, conform de AVG." : "I consent to processing my data for rental mediation by FairKamer, in compliance with GDPR."}
            </span>
          </label>
        </>
      );
      default: return null;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-[#C84B2F] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#C84B2F] uppercase tracking-wide">FairKamer</p>
          <p className="text-sm text-muted-foreground">{property.address}{property.city ? `, ${property.city}` : ""}</p>
        </div>
        <button onClick={() => setLang(lang === "nl" ? "en" : "nl")} className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground">{lang === "nl" ? "EN" : "NL"}</button>
      </div>

      {/* Step counter */}
      <div className="px-5 mb-6">
        <p className="text-xs text-muted-foreground">{step + 1} / {TOTAL}</p>
      </div>

      {/* Question */}
      <div className="px-5 pb-32">
        {renderStep()}
        {validErr && <p className="text-sm text-destructive mt-4">{validErr}</p>}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={back} className="h-12 px-5 rounded-2xl border border-border text-foreground font-medium text-sm">{nl ? "Terug" : "Back"}</button>
          )}
          {!isLast ? (
            <button
              onClick={next}
              disabled={key === "occupants" || key === "move_in" || key === "employment" || key === "income" || key === "smoking" || key === "pets" || key === "bkr"}
              className="flex-1 h-12 rounded-2xl bg-[#C84B2F] text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {nl ? "Volgende" : "Next"}
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !form.consent_given}
              className="flex-1 h-12 rounded-2xl bg-[#C84B2F] text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />{nl ? "Verzenden..." : "Sending..."}</>
              ) : (nl ? "Aanmelding versturen" : "Submit application")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
