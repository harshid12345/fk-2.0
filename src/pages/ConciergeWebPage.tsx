import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  address: string;
  city: string;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  category?: "trivial" | "needs_attention" | "urgent";
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category, t }: { category?: string; t: (k: string) => string }) {
  if (!category) return null;
  const map = {
    trivial: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    needs_attention: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  const labelKey = `concierge.category_${category}`;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[category as keyof typeof map] || ""}`}>
      {t(labelKey)}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConciergeWebPage() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang, t } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [property, setProperty] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tenantName, setTenantName] = useState(() =>
    localStorage.getItem(`fk_concierge_name_${token}`) ?? ""
  );
  const [nameSet, setNameSet] = useState(() =>
    !!localStorage.getItem(`fk_concierge_name_${token}`)
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`fk_concierge_msgs_${token}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // ─── Load property ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setLoadError(t("concierge.invalid_link")); return; }

    supabase
      .from("landlord_properties")
      .select("id, address, city")
      .eq("concierge_token", token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setLoadError(t("concierge.invalid_link"));
        else setProperty(data as Property);
      });
  }, [token]);

  // ─── Persist messages ──────────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length) {
      localStorage.setItem(`fk_concierge_msgs_${token}`, JSON.stringify(messages));
    }
  }, [messages]);

  // ─── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Name submit ───────────────────────────────────────────────────────────

  function saveName() {
    const name = tenantName.trim() || t("concierge.your_message");
    localStorage.setItem(`fk_concierge_name_${token}`, name);
    setTenantName(name);
    setNameSet(true);
  }

  // ─── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setSendError("");
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/concierge-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concierge_token: token,
          message: text,
          tenant_name: tenantName || undefined,
          preferred_language: lang,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: data.ai_response,
            category: data.category,
          },
        ]);
      } else {
        setSendError(t("concierge.error"));
      }
    } catch {
      setSendError(t("concierge.error"));
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ─── Error state ───────────────────────────────────────────────────────────

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

  // ─── Name prompt ───────────────────────────────────────────────────────────

  if (!nameSet) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="border-b border-border px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-serif font-bold text-lg text-foreground">{t("concierge.title")}</h1>
              <p className="text-xs text-muted-foreground">{property.address}, {property.city}</p>
            </div>
            <button
              onClick={() => setLang(lang === "en" ? "nl" : "en")}
              className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground"
            >
              {lang === "en" ? "NL" : "EN"}
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full">
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">{t("concierge.subtitle")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("concierge.name_prompt")}</p>
            <Input
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Jan de Vries"
              className="mb-3"
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />
            <Button
              className="w-full bg-[#C84B2F] hover:bg-[#b03f26] text-white"
              onClick={saveName}
            >
              {t("concierge.send")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Chat UI ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif font-bold text-base text-foreground">{t("concierge.title")}</h1>
            <p className="text-xs text-muted-foreground">{property.address}, {property.city}</p>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "nl" : "en")}
            className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground"
          >
            {lang === "en" ? "NL" : "EN"}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm text-muted-foreground">{t("concierge.subtitle")}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${msg.role === "user" ? "" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-[#C84B2F] text-white rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"}`}
                >
                  {msg.content}
                </div>
                {msg.role === "ai" && msg.category && (
                  <div className="mt-1.5 ml-1">
                    <CategoryBadge category={msg.category} t={t} />
                  </div>
                )}
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-right text-muted-foreground" : "text-muted-foreground"}`}>
                  {msg.role === "user" ? t("concierge.your_message") : t("concierge.ai_label")}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          {sendError && <p className="text-sm text-destructive mb-2">{sendError}</p>}
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("concierge.placeholder")}
              rows={1}
              className="resize-none flex-1 min-h-[44px] max-h-32"
            />
            <Button
              className="bg-[#C84B2F] hover:bg-[#b03f26] text-white h-11 px-4 shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? "…" : "→"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
