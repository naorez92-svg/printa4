import { createClient } from "jsr:@supabase/supabase-js@2";

// admin-set-plan — activate (or downgrade) a user's subscription from the
// admin panel: find the user by email, set profiles.plan (the DB trigger from
// 0007/0010 stamps pro_since automatically), log an audit event, and send the
// customer a branded "המנוי פעיל" confirmation email.

const VALID_PLANS = ["teacher", "parent", "pro", "free", "pack5"] as const;
const PLAN_LABEL: Record<string, string> = {
  teacher: "מורה פרטית", parent: "הורה", pro: "פרו", free: "חינם", pack5: "חבילת 5 חוברות",
};
const PACK5_CREDITS = 5;

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
    // Caller must be an admin — this changes billing state.
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !caller) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: callerProfile } = await admin.from("profiles").select("plan").eq("id", caller.id).single();
    if (callerProfile?.plan !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const plan = String(body?.plan ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: cors });
    }
    if (!VALID_PLANS.includes(plan as typeof VALID_PLANS[number])) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), { status: 400, headers: cors });
    }

    // Find the user by email (listUsers caps at 1000 per page — page through).
    let target: { id: string; email?: string } | null = null;
    for (let page = 1; page <= 5 && !target; page++) {
      const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr) break;
      target = (pageData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
      if ((pageData?.users ?? []).length < 1000) break;
    }
    if (!target) return new Response(JSON.stringify({ error: "user_not_found" }), { status: 404, headers: cors });

    if (plan === "pack5") {
      // One-time pack: ADD +5 to the cumulative granted counter, don't touch
      // the plan (the user stays free — the pack is the pre-subscription
      // offer). Read-modify-write is fine: only the admin writes this column,
      // and consumption is implicit via total_booklets_created (mig. 0044).
      const { data: cur, error: curErr } = await admin
        .from("profiles").select("booklet_credits_granted").eq("id", target.id).single();
      if (curErr) {
        console.error("admin-set-plan credits read:", curErr.message);
        return new Response(JSON.stringify({ error: "update_failed" }), { status: 500, headers: cors });
      }
      const { error: credErr } = await admin
        .from("profiles")
        .update({ booklet_credits_granted: (cur?.booklet_credits_granted ?? 0) + PACK5_CREDITS })
        .eq("id", target.id);
      if (credErr) {
        console.error("admin-set-plan credits update:", credErr.message);
        return new Response(JSON.stringify({ error: "update_failed" }), { status: 500, headers: cors });
      }
    } else {
      // Stamp the billing cycle explicitly: the 0010 trigger sets pro_since only
      // on free→paid, so re-activating a RENEWING subscriber (teacher→teacher)
      // would keep a stale cycle and month-2 renewal reminders would never send.
      const update = plan === "free"
        ? { plan }
        : { plan, pro_since: new Date().toISOString(), renewal_reminder_sent_at: null };
      const { error: updateErr } = await admin
        .from("profiles")
        .update(update)
        .eq("id", target.id);
      if (updateErr) {
        console.error("admin-set-plan update:", updateErr.message);
        return new Response(JSON.stringify({ error: "update_failed" }), { status: 500, headers: cors });
      }
    }

    // Audit trail — who activated what, visible in events.
    admin.from("events").insert({
      user_id: target.id,
      event: plan === "pack5" ? "pack_activated" : "plan_activated",
      metadata: { plan, by: caller.email ?? caller.id },
    }).then(() => {}, () => {});

    // Confirmation email to the customer (best-effort — activation already done).
    let emailed = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && plan !== "free") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "בשבילי <hello@beshvili.com>",
          to: [email],
          reply_to: "naorez92@gmail.com",
          subject: plan === "pack5"
            ? "החבילה שלך פעילה — 5 חוברות מחכות לך 🎉"
            : `המנוי שלך פעיל — ברוכה הבאה לבשבילי ${PLAN_LABEL[plan]} 🎉`,
          html: `<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:28px;border:1px solid #eee;">
    <p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#20184A;">בשבילי<span style="color:#F4A02C;">·</span></p>
    <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px;">
    <div style="font-size:40px;text-align:center;">🎉</div>
    <h2 style="color:#20184A;text-align:center;margin:8px 0 14px;">${plan === "pack5" ? "החבילה שלך פעילה!" : "המנוי שלך פעיל!"}</h2>
    <p style="font-size:15px;color:#333;text-align:center;">${plan === "pack5"
      ? `<strong style="color:#6C5CE7;">5 חוברות מלאות</strong> נוספו לחשבון (עד 10 עמודים + מפתח תשובות) — בלי מנוי, בלי תפוגה. אפשר להתחיל ליצור עכשיו.`
      : `תוכנית <strong style="color:#6C5CE7;">${PLAN_LABEL[plan]}</strong> הופעלה — אפשר להתחיל ליצור עכשיו.`}</p>
    <div style="text-align:center;margin:22px 0 8px;">
      <a href="https://beshvili.com" style="display:inline-block;background:#6C5CE7;color:white;padding:13px 30px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;">✨ ליצירת החוברת הבאה</a>
    </div>
    <p style="font-size:13px;color:#888;margin:18px 0 0;">טיפ: על כל חוברת מודפסת יש QR קטן — סרקו אחרי שהילדים פותרים, והחוברת הבאה תתמקד בדיוק במה שהיה קשה 🎯</p>
    <p style="color:#aaa;font-size:11px;text-align:center;margin:20px 0 0;">שאלות? פשוט השיבו למייל · בשבילי · beshvili.com</p>
  </div></body></html>`,
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("admin-set-plan resend:", await res.text());
    }

    return new Response(JSON.stringify({ ok: true, email, plan, emailed }), {
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("admin-set-plan error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: cors });
  }
});
