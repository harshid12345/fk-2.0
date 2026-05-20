import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CM_API_KEY = Deno.env.get("CM_API_KEY") ?? "";
const CM_SENDER = "FairKamer";

interface SmsRequest {
  to: string;       // E.164 format: +31612345678
  message: string;
}

interface SmsResponse {
  success: boolean;
  error?: string;
}

async function sendSms(to: string, message: string): Promise<SmsResponse> {
  // Normalize number: strip spaces/dashes, ensure starts with +
  const normalized = to.replace(/[\s\-]/g, "");
  const number = normalized.startsWith("+") ? normalized : `+${normalized}`;

  const payload = {
    messages: {
      authentication: {
        producttoken: CM_API_KEY,
      },
      msg: [
        {
          from: CM_SENDER,
          to: [{ number }],
          body: { content: message },
          reference: crypto.randomUUID(),
        },
      ],
    },
  };

  const res = await fetch("https://gw.cmtelecom.com/v1.0/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[sms-send] CM.com error:", res.status, text);
    return { success: false, error: `CM.com ${res.status}: ${text}` };
  }

  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { to, message } = (await req.json()) as SmsRequest;

    if (!to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'to' or 'message'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await sendSms(to, message);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sms-send] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
