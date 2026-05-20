import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  address: string;
  city: string;
  postcode: string;
  rent_amount: number;
  property_type: string;
  available_date: string;
}

interface FormState {
  phone: string;
  email: string;
  full_name: string;
  age: string;
  gender: string;
  num_occupants: string;
  desired_move_in: string;
  employment_type: string;
  monthly_income_range: string;
  desired_lease_length: string;
  smoking: string;
  pets: string;
  bkr_status: string;
  social_handle: string;
  consent_given: boolean;
}

const EMPTY_FORM: FormState = {
  phone: "",
  email: "",
  full_name: "",
  age: "",
  gender: "",
  num_occupants: "",
  desired_move_in: "",
  employment_type: "",
  monthly_income_range: "",
  desired_lease_length: "",
  smoking: "",
  pets: "",
  bkr_status: "",
  social_handle: "",
  consent_given: false,
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionBtn({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all
        ${
          selected
            ? "border-[#C84B2F] bg-[#C84B2F]/10 text-[#C84B2F]"
            : "border-border bg-card text-foreground hover:border-[#C84B2F]/50"
        }`}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang, t } = useLanguage();

  const [property, setProperty] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const TOTAL_STEPS = 15; // 0=phone, 1=email … 14=consent

  // ─── Load property from token ──────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoadError(t("apply.invalid_link")); return; }

    fetch(`${SUPABASE_URL}/functions/v1/get-property`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_token: token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.id) {
          setLoadError(t("apply.invalid_link"));
        } else {
          setProperty(data as Property);
          // Check localStorage for partial progress
          const saved = localStorage.getItem(`fk_apply_${token}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.phone) {
                setForm((f) => ({ ...f, ...parsed }));
                setResumed(true);
                setStep(parsed._step || 0);
              }
            } catch { /* ignore */ }
          }
        }
      })
      .catch(() => setLoadError(t("apply.invalid_link")));
  }, [token]);

  // ─── Save progress to localStorage ────────────────────────────────────────

  useEffect(() => {
    if (!token || !form.phone) return;
    localStorage.setItem(`fk_apply_${token}`, JSON.stringify({ ...form, _step: step }));
  }, [form, step]);

  // ─── Navigation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    setValidationError("");
    if (step === 0) {
      const cleaned = form.phone.replace(/\s/g, "");
      if (!cleaned || !/^\+?[0-9]{8,15}$/.test(cleaned)) {
        setValidationError(t("apply.phone_invalid"));
        return false;
      }
    }
    if (step === 1) {
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setValidationError(t("apply.email_invalid") || "Please enter a valid email address");
        return false;
      }
    }
    if (step === 2 && !form.full_name.trim()) {
      setValidationError(t("apply.q_name"));
      return false;
    }
    if (step === 3) {
      const age = parseInt(form.age);
      if (!form.age || isNaN(age) || age < 18 || age > 99) {
        setValidationError(t("apply.age_invalid"));
        return false;
      }
    }
    if (step === 4 && !form.gender) return false;
    if (step === 5 && !form.num_occupants) return false;
    if (step === 6 && !form.desired_move_in) return false;
    if (step === 7 && !form.employment_type) return false;
    if (step === 8 && !form.monthly_income_range) return false;
    if (step === 9 && !form.desired_lease_length) return false;
    if (step === 10 && !form.smoking) return false;
    if (step === 11 && !form.pets) return false;
    if (step === 12 && !form.bkr_status) return false;
    if (step === 14) {
      if (!form.consent_given) {
        setValidationError(t("apply.consent_required"));
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validate()) return;
    if (step === 13 && !form.social_handle) {
      // social is optional — allow skip
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setValidationError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!form.consent_given) {
      setValidationError(t("apply.consent_required"));
      return;
    }
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
          gender: form.gender,
          num_occupants: form.num_occupants,
          desired_move_in: form.desired_move_in,
          employment_type: form.employment_type,
          monthly_income_range: form.monthly_income_range,
          desired_lease_length: form.desired_lease_length,
          smoking: form.smoking,
          pets: form.pets,
          bkr_status: form.bkr_status,
          social_handle: form.social_handle || null,
          consent_given: true,
          preferred_language: lang,
        }),
      });
      if (res.ok) {
        localStorage.removeItem(`fk_apply_${token}`);
        setDone(true);
      } else {
        const err = await res.json();
        setValidationError(err.error || t("apply.error_submit"));
      }
    } catch {
      setValidationError(t("apply.error_submit"));
    }
    setSubmitting(false);
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  function sel(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setValidationError("");
  }

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🏠</div>
          <p className="text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ─── Success screen ────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-3">
            {t("apply.success_title")}
          </h1>
          <p className="text-muted-foreground mb-6">{t("apply.success_body")}</p>
          <p className="text-xs text-muted-foreground">{t("apply.powered_by")}</p>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);
  const stepLabel = t("apply.step_of", {
    current: String(step + 1),
    total: String(TOTAL_STEPS),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2 max-w-lg mx-auto">
          <div>
            <p className="text-xs text-muted-foreground">{t("apply.apply_for")}</p>
            <p className="font-semibold text-sm text-foreground truncate max-w-[200px]">
              {property.address}, {property.city}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#C84B2F]">
              €{property.rent_amount?.toLocaleString("nl-NL")}{t("apply.rent_per_month")}
            </span>
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "nl" : "en")}
              className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:border-primary transition-colors"
            >
              {lang === "en" ? "NL" : "EN"}
            </button>
          </div>
        </div>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{stepLabel}</span>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Resume banner */}
      {resumed && step === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2 text-center">
          <p className="text-xs text-blue-700 dark:text-blue-300">{t("apply.resume_banner")}</p>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center px-4 py-8 max-w-lg mx-auto w-full">
        <StepContent
          step={step}
          form={form}
          setForm={setForm}
          sel={sel}
          t={t}
          validationError={validationError}
          setValidationError={setValidationError}
        />
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={back}>
              {t("apply.back")}
            </Button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <Button className="flex-1 bg-[#C84B2F] hover:bg-[#b03f26] text-white" onClick={next}>
              {t("apply.next")}
            </Button>
          ) : (
            <Button
              className="flex-1 bg-[#C84B2F] hover:bg-[#b03f26] text-white"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? t("apply.submitting") : t("apply.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Content ─────────────────────────────────────────────────────────────

function StepContent({
  step,
  form,
  setForm,
  sel,
  t,
  validationError,
  setValidationError,
}: {
  step: number;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  sel: (field: keyof FormState, value: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
  validationError: string;
  setValidationError: (v: string) => void;
}) {
  function Q({ children }: { children: React.ReactNode }) {
    return (
      <h2 className="text-2xl font-serif font-bold text-foreground mb-6 leading-tight">
        {children}
      </h2>
    );
  }

  function Err() {
    if (!validationError) return null;
    return <p className="text-sm text-destructive mt-2">{validationError}</p>;
  }

  switch (step) {
    case 0:
      return (
        <div>
          <Q>{t("apply.q_phone")}</Q>
          <p className="text-sm text-muted-foreground mb-4">{t("apply.q_phone_hint")}</p>
          <Input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setValidationError(""); }}
            placeholder="+31612345678"
            className="text-lg h-12"
            autoFocus
          />
          <Err />
        </div>
      );

    case 1:
      return (
        <div>
          <Q>{t("apply.q_email") || "What's your email address?"}</Q>
          <p className="text-sm text-muted-foreground mb-4">{t("apply.q_email_hint") || "We'll send updates about your application here."}</p>
          <Input
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setValidationError(""); }}
            placeholder="you@example.com"
            className="text-lg h-12"
            autoFocus
          />
          <Err />
        </div>
      );

    case 2:
      return (
        <div>
          <Q>{t("apply.q_name")}</Q>
          <Input
            type="text"
            value={form.full_name}
            onChange={(e) => { setForm((f) => ({ ...f, full_name: e.target.value })); setValidationError(""); }}
            placeholder="Jan de Vries"
            className="text-lg h-12"
            autoFocus
          />
          <Err />
        </div>
      );

    case 3:
      return (
        <div>
          <Q>{t("apply.q_age")}</Q>
          <Input
            type="number"
            inputMode="numeric"
            min={18}
            max={99}
            value={form.age}
            onChange={(e) => { setForm((f) => ({ ...f, age: e.target.value })); setValidationError(""); }}
            placeholder="25"
            className="text-lg h-12 w-32"
            autoFocus
          />
          <Err />
        </div>
      );

    case 4:
      return (
        <div>
          <Q>{t("apply.q_gender")}</Q>
          <div className="space-y-3">
            {(["apply.q_gender_male", "apply.q_gender_female", "apply.q_gender_other"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.gender === t(k)} onClick={() => sel("gender", t(k))} />
            ))}
          </div>
        </div>
      );

    case 5:
      return (
        <div>
          <Q>{t("apply.q_occupants")}</Q>
          <div className="space-y-3">
            {(["apply.opt_just_me", "apply.opt_2_people", "apply.opt_3_people", "apply.opt_4plus"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.num_occupants === t(k)} onClick={() => sel("num_occupants", t(k))} />
            ))}
          </div>
        </div>
      );

    case 6:
      return (
        <div>
          <Q>{t("apply.q_move_in")}</Q>
          <div className="space-y-3">
            {(["apply.opt_asap", "apply.opt_next_month", "apply.opt_2_3_months", "apply.opt_flexible"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.desired_move_in === t(k)} onClick={() => sel("desired_move_in", t(k))} />
            ))}
          </div>
        </div>
      );

    case 7:
      return (
        <div>
          <Q>{t("apply.q_employment")}</Q>
          <div className="space-y-3">
            {(["apply.opt_loondienst", "apply.opt_zzp", "apply.opt_student", "apply.opt_uitkering"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.employment_type === t(k)} onClick={() => sel("employment_type", t(k))} />
            ))}
          </div>
        </div>
      );

    case 8:
      return (
        <div>
          <Q>{t("apply.q_income")}</Q>
          <div className="space-y-3">
            {(["apply.opt_under_1500", "apply.opt_1500_2500", "apply.opt_2500_3500", "apply.opt_3500_5000", "apply.opt_5000plus"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.monthly_income_range === t(k)} onClick={() => sel("monthly_income_range", t(k))} />
            ))}
          </div>
        </div>
      );

    case 9:
      return (
        <div>
          <Q>{t("apply.q_lease")}</Q>
          <div className="space-y-3">
            {(["apply.opt_6mo", "apply.opt_1yr", "apply.opt_2yr", "apply.opt_as_long"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.desired_lease_length === t(k)} onClick={() => sel("desired_lease_length", t(k))} />
            ))}
          </div>
        </div>
      );

    case 10:
      return (
        <div>
          <Q>{t("apply.q_smoking")}</Q>
          <div className="space-y-3">
            {(["apply.opt_no_smoking", "apply.opt_outside", "apply.opt_yes_smoking"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.smoking === t(k)} onClick={() => sel("smoking", t(k))} />
            ))}
          </div>
        </div>
      );

    case 11:
      return (
        <div>
          <Q>{t("apply.q_pets")}</Q>
          <div className="space-y-3">
            {(["apply.opt_no_pets", "apply.opt_cat", "apply.opt_dog", "apply.opt_other_pet"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.pets === t(k)} onClick={() => sel("pets", t(k))} />
            ))}
          </div>
        </div>
      );

    case 12:
      return (
        <div>
          <Q>{t("apply.q_bkr")}</Q>
          <div className="space-y-3">
            {(["apply.opt_no_bkr", "apply.opt_yes_bkr"] as const).map((k) => (
              <OptionBtn key={k} label={t(k)} selected={form.bkr_status === t(k)} onClick={() => sel("bkr_status", t(k))} />
            ))}
          </div>
        </div>
      );

    case 13:
      return (
        <div>
          <Q>{t("apply.q_social")}</Q>
          <p className="text-sm text-muted-foreground mb-4">{t("apply.q_social_hint")}</p>
          <Input
            type="url"
            inputMode="url"
            value={form.social_handle}
            onChange={(e) => setForm((f) => ({ ...f, social_handle: e.target.value }))}
            placeholder="https://linkedin.com/in/username"
            className="text-base h-12"
          />
        </div>
      );

    case 14:
      return (
        <div>
          <Q>{t("apply.q_consent")}</Q>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={form.consent_given}
              onCheckedChange={(v) => setForm((f) => ({ ...f, consent_given: !!v }))}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              {t("apply.consent_text")}
            </span>
          </label>
          {validationError && <p className="text-sm text-destructive mt-3">{validationError}</p>}
        </div>
      );

    default:
      return null;
  }
}
