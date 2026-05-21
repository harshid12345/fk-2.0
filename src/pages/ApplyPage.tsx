import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Property {
  id: string;
  address: string;
  city: string;
  postcode: string;
  rent_amount: number;
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
  consent_given: boolean;
}

const EMPTY: FormState = {
  phone: "", email: "", full_name: "", age: "",
  num_occupants: "", desired_move_in: "",
  employment_type: "", monthly_income_range: "",
  smoking: "", pets: "", bkr_status: "",
  consent_given: false,
};

// Step indexes
const STEPS = [
  "phone", "email", "name", "age",
  "occupants", "move_in",
  "employment", "income",
  "smoking", "pets",
  "bkr", "consent",
] as const;
const TOTAL = STEPS.length; // 12

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

  // ─── Load property ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoadError(lang === "nl" ? "Ongeldige link." : "Invalid link."); return; }
    fetch(`${SUPABASE_URL}/rest/v1/landlord_properties?application_token=eq.${encodeURIComponent(token)}&select=id,address,city,postcode,rent_amount&limit=1`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then(r => r.json())
      .then(data => {
        const prop = Array.isArray(data) ? data[0] : null;
        if (!prop?.id) { setLoadError(lang === "nl" ? "Ongeldige link — neem contact op met de verhuurder." : "Invalid link — contact the landlord."); return; }
        setProperty(prop as Property);
        const saved = localStorage.getItem(`fk_apply_${token}`);
        if (saved) { try { const p = JSON.parse(saved); if (p.phone) { setForm(f => ({ ...f, ...p })); setStep(p._step || 0); } } catch { /* ignore */ } }
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
    if (key === "consent" && !form.consent_given) { setValidErr(nl ? "Je moet akkoord gaan om door te gaan." : "You must agree to continue."); return false; }
    return true;
  }

  function next() { if (!validate()) return; if (step < TOTAL - 1) setStep(s => s + 1); }
  function back() { setValidErr(""); setStep(s => Math.max(s - 1, 0)); }

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
          consent_given: true,
          preferred_language: lang,
        }),
      });
      if (res.ok) { localStorage.removeItem(`fk_apply_${token}`); setDone(true); }
      else { const e = await res.json(); setValidErr(e.error || (nl ? "Er ging iets mis." : "Something went wrong.")); }
    } catch { setValidErr(nl ? "Controleer je verbinding." : "Check your connection."); }
    setSubmitting(false);
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

  // ─── Done ──────────────────────────────────────────────────────────────────

  if (done) return (
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
        <p className="text-xs text-muted-foreground mt-8">Powered by FairKamer</p>
      </div>
    </div>
  );

  // ─── Step content ──────────────────────────────────────────────────────────

  const progress = (step / (TOTAL - 1)) * 100;
  const key = STEPS[step];
  const isLast = step === TOTAL - 1;

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
          <input type="text" value={form.full_name} onChange={e => s("full_name", e.target.value)} placeholder={nl ? "Jan de Vries" : "Jan de Vries"} autoComplete="name"
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
              <Opt key={v} label={v} selected={form.num_occupants === v} onClick={() => { s("num_occupants", v); setTimeout(next, 120); }} />
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
              <Opt key={val} label={label} selected={form.desired_move_in === val} onClick={() => { s("desired_move_in", val); setTimeout(next, 120); }} />
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
              <Opt key={val} label={label} selected={form.employment_type === val} onClick={() => { s("employment_type", val); setTimeout(next, 120); }} />
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
              <Opt key={v} label={v} selected={form.monthly_income_range === v} onClick={() => { s("monthly_income_range", v); setTimeout(next, 120); }} />
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
              <Opt key={val} label={label} selected={form.smoking === val} onClick={() => { s("smoking", val); setTimeout(next, 120); }} />
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
              <Opt key={val} label={label} selected={form.pets === val} onClick={() => { s("pets", val); setTimeout(next, 120); }} />
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
              <Opt key={val} label={label} selected={form.bkr_status === val} onClick={() => { s("bkr_status", val); setTimeout(next, 120); }} />
            ))}
          </div>
        </>
      );
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
