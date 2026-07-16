import { createClient } from "jsr:@supabase/supabase-js@2";

// send-payment-instructions — one admin click sends the lead a branded,
// step-by-step payment email (amount by requested plan, Bit number, WhatsApp
// link for the receipt screenshot, 1-hour activation promise). Replaces the
// empty mailto draft the owner had to hand-write every time.

const BIT_PHONE = "050-9139137";
const WA_LINK = "https://wa.me/972509139137";

const PLANS: Record<string, { label: string; price: string; period: string }> = {
  teacher: { label: "מורה פרטית", price: "59",  period: "לחודש" },
  parent:  { label: "הורה",        price: "19",  period: "לחודש" },
  pro:     { label: "פרו",         price: "30",  period: "לחודש" }, // legacy pro pays 30 (matches renewal email + P&L)
  compass: { label: "מצפן — דוח",  price: "49",  period: "חד־פעמי" },
};

function getCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    origin === "https://www.beshvili.com" ||
    origin === "https://beshvili.com" ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:4173" ||
    /^https:\/\/printa4-git-[a-z0-9-]+-naor-s-projects\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://www.beshvili.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Admin-only: this sends outbound email in the product's name.
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name  = String(body?.name ?? "").replace(/[\r\n\t]/g, " ").trim().substring(0, 100);
    const plan  = PLANS[String(body?.plan ?? "")] ? String(body.plan) : "teacher";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: cors });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: cors });

    // Honor the price PROMISED at click time (first-month sale ₪29/₪9) — the
    // customer must never be emailed a bigger number than the one they saw.
    const priceOverride = Number.isFinite(Number(body?.price)) && Number(body.price) > 0 && Number(body.price) <= 500
      ? String(Number(body.price)) : null;
    const base = PLANS[plan];
    const p = priceOverride ? { ...base, price: priceOverride } : base;
    const isSale = priceOverride && Number(priceOverride) < Number(base.price);
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hi = name ? `היי ${esc(name)},` : "היי,";

    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:28px;border:1px solid #eee;">
    <p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#20184A;">בשבילי<span style="color:#F4A02C;">·</span></p>
    <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px;">
    <h2 style="color:#20184A;margin:0 0 14px;">ההפעלה שלך — צעד אחד ואת/ה בפנים 🎉</h2>
    <p style="font-size:15px;color:#333;">${hi}</p>
    <p style="font-size:15px;color:#333;">איזה כיף שבחרת בתוכנית <strong style="color:#6C5CE7;">${p.label}</strong> — <strong>₪${p.price} ${p.period}</strong>${isSale ? ` <span style="color:#F4A02C;font-weight:bold;">(מחיר מבצע לחודש הראשון — מהחודש השני ₪${base.price})</span>` : ""}. ככה מפעילים, לוקח דקה:</p>

    <div style="background:#F7F6FB;border-radius:12px;padding:16px 18px;margin:18px 0;">
      <p style="font-size:15px;color:#20184A;margin:0 0 10px;"><strong>1.</strong> 💙 שלחו <strong>₪${p.price}</strong> בביט למספר <strong dir="ltr">${BIT_PHONE}</strong></p>
      <p style="font-size:15px;color:#20184A;margin:0 0 10px;"><strong>2.</strong> 📸 שלחו צילום מסך של ההעברה לוואטסאפ שלנו</p>
      <p style="font-size:15px;color:#20184A;margin:0;"><strong>3.</strong> ⚡ אנחנו מפעילים תוך שעה — ותקבלו אישור בוואטסאפ</p>
    </div>

    <div style="text-align:center;margin:22px 0 8px;">
      <a href="${WA_LINK}?text=${encodeURIComponent(`היי! שלחתי ₪${p.price} בביט לתוכנית ${p.label} 🙂 מצרפ/ת צילום:`)}"
         style="display:inline-block;background:#25D366;color:white;padding:13px 30px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;">
        💬 לשליחת הצילום בוואטסאפ
      </a>
    </div>

    <p style="font-size:13px;color:#888;margin:18px 0 0;">שאלות? פשוט השיבו למייל הזה. ביטול בכל עת — בלי התחייבות.</p>
    <p style="color:#aaa;font-size:11px;text-align:center;margin:20px 0 0;">בשבילי · <a href="https://beshvili.com" style="color:#aaa;">beshvili.com</a></p>
  </div></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "בשבילי <hello@beshvili.com>",
        to: [email],
        reply_to: "naorez92@gmail.com",
        subject: `ההפעלה שלך לבשבילי ${p.label} — צעד אחד 🎉`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("send-payment-instructions resend:", await res.text());
      return new Response(JSON.stringify({ error: "email_failed" }), { status: 502, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("send-payment-instructions error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: cors });
  }
});
