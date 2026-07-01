import { useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const COLORS = [
  { id: "purple", label: "סגול", tw: "bg-purple-500", preview: "#8B5CF6" },
  { id: "blue",   label: "כחול", tw: "bg-blue-500",   preview: "#3B82F6" },
  { id: "green",  label: "ירוק", tw: "bg-emerald-500",preview: "#10B981" },
  { id: "orange", label: "כתום", tw: "bg-orange-500", preview: "#F97316" },
  { id: "pink",   label: "ורוד", tw: "bg-pink-500",   preview: "#EC4899" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const LOGO_BUCKET  = "teacher-logos";

async function uploadLogo(file, userId) {
  const ext  = file.name.split(".").pop() || "png";
  const path = `${userId}/logo.${ext}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return publicUrl;
}

export default function BrandingSettings({ profile, onSaved }) {
  const [name,     setName]     = useState(profile?.teacher_display_name ?? "");
  const [tagline,  setTagline]  = useState(profile?.teacher_tagline       ?? "");
  const [phone,    setPhone]    = useState(profile?.teacher_phone          ?? "");
  const [logoUrl,  setLogoUrl]  = useState(profile?.teacher_logo_url       ?? "");
  const [color,    setColor]    = useState(profile?.teacher_color          ?? "purple");
  const [saving,   setSaving]   = useState(false);
  const [uploading,setUploading]= useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const fileRef = useRef(null);

  const handleLogoFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("הלוגו חייב להיות קטן מ-2MB"); return; }
    setUploading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const url = await uploadLogo(file, user.id);
      setLogoUrl(url);
    } catch {
      setError("העלאת הלוגו נכשלה — נסי שנית");
    } finally {
      setUploading(false);
    }
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("profiles").update({
      teacher_display_name: name.trim()    || null,
      teacher_tagline:      tagline.trim() || null,
      teacher_phone:        phone.trim()   || null,
      teacher_logo_url:     logoUrl        || null,
      teacher_color:        color,
    }).eq("id", user.id);
    setSaving(false);
    if (err) { setError("שמירה נכשלה — נסי שנית"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved?.();
  };

  const selectedColor = COLORS.find(c => c.id === color) ?? COLORS[0];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-l from-magic/8 to-brand/8 border border-magic/15 rounded-2xl px-4 py-3.5">
        <h2 className="text-xl font-bold text-ink font-display">🎨 מיתוג אישי</h2>
        <p className="text-sm text-ink/50 mt-0.5">השם, הלוגו וצבע העיצוב יופיעו בכל חוברת שתיצרי</p>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl overflow-hidden border border-ink/10 shadow-md">
        <div
          className="px-5 py-5 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${selectedColor.preview}, ${selectedColor.preview}cc)` }}
        >
          {/* Decorative shapes */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-8 right-1/2 w-20 h-20 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute top-2 left-3 w-7 h-7 rounded-full bg-white/20 pointer-events-none" />
          {logoUrl && (
            <img src={logoUrl} alt="לוגו"
              className="absolute top-3 left-4 h-10 w-10 object-contain rounded-lg bg-white/25 p-1" />
          )}
          <div className="relative">
            <div className="text-[10px] font-semibold text-white/50 mb-1 tracking-wide">✦ שער החוברת</div>
            <div className="text-xl font-bold font-display leading-tight">{name || "שם המורה"}</div>
            {tagline && <div className="text-xs text-white/75 mt-1">{tagline}</div>}
          </div>
        </div>
        <div className="bg-white px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] text-ink/30">
            {name || "שם המורה"}{tagline ? ` · ${tagline}` : ""}
          </span>
          {phone && <span className="text-[10px] text-ink/30">📞 {phone}</span>}
        </div>
        <div className="bg-canvas px-5 py-1.5 text-[9px] text-ink/20 text-center border-t border-ink/5">
          ✨ beshvili.com
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">

        {/* Logo upload */}
        <div>
          <p className="text-xs font-semibold text-ink/60 mb-2">לוגו (אופציונלי)</p>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="לוגו" className="h-14 w-14 object-contain rounded-xl border border-ink/10 bg-canvas p-1" />
            ) : (
              <div className="h-14 w-14 rounded-xl border-2 border-dashed border-ink/20 flex items-center justify-center text-ink/25 text-2xl bg-canvas">🏷️</div>
            )}
            <div className="flex-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-sm border border-magic/40 text-magic rounded-xl px-4 py-2 hover:bg-magic/5 transition-colors font-medium disabled:opacity-50"
              >
                {uploading ? "מעלה..." : logoUrl ? "החלף לוגו" : "העלי לוגו"}
              </button>
              <p className="text-[10px] text-ink/35 mt-1">PNG/JPG · עד 2MB · מומלץ ריבועי</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            {logoUrl && (
              <button onClick={() => setLogoUrl("")} className="text-ink/30 hover:text-red-400 text-lg transition-colors">×</button>
            )}
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="text-xs font-semibold text-ink/60 block mb-1.5">שם תצוגה</label>
          <input
            className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm transition-colors"
            placeholder='ד"ר שרית כהן'
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
          />
        </div>

        {/* Tagline */}
        <div>
          <label className="text-xs font-semibold text-ink/60 block mb-1.5">תגלין (אופציונלי)</label>
          <input
            className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm transition-colors"
            placeholder="מורה פרטית | כיתות א–ו | תל אביב"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-semibold text-ink/60 block mb-1.5">טלפון / וואטסאפ (אופציונלי — יופיע בעמוד האחרון)</label>
          <input
            className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm transition-colors"
            placeholder="050-xxx-xxxx"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            maxLength={20}
            type="tel"
            dir="ltr"
          />
        </div>

        {/* Color theme */}
        <div>
          <label className="text-xs font-semibold text-ink/60 block mb-2">ערכת צבעים</label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                  color === c.id ? "border-ink/25 scale-105 shadow-md bg-white" : "border-transparent hover:border-ink/10 hover:bg-white/60"
                }`}
              >
                <span
                  className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center text-white text-sm font-bold transition-all"
                  style={{ background: c.preview }}
                >
                  {color === c.id ? "✓" : ""}
                </span>
                <span className="text-[10px] text-ink/60 font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className={`w-full rounded-xl p-3.5 font-display font-semibold text-sm transition-all shadow-sm ${
            saved
              ? "bg-grow/10 border border-grow/30 text-grow"
              : "bg-gradient-to-l from-brand to-magic text-white hover:opacity-90 disabled:opacity-50"
          }`}
        >
          {saving ? "שומר..." : saved ? "✓ נשמר!" : "שמור מיתוג ✨"}
        </button>

        <p className="text-[10px] text-ink/30 text-center">
          המיתוג יופיע בכל החוברות החדשות שתיצרי מעכשיו
        </p>
      </div>
    </div>
  );
}
