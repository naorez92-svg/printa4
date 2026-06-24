import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import QuickCreate from "./QuickCreate";
import StudentHistory from "./StudentHistory";

const GRADES = [
  "גן חובה", "כיתה א", "כיתה ב", "כיתה ג", "כיתה ד",
  "כיתה ה", "כיתה ו", "כיתה ז", "כיתה ח", "כיתה ט",
];
const LEVELS = [["basic", "🌱 בסיסי"], ["medium", "⚡ בינוני"], ["advanced", "🚀 מתקדם"]];
const LEVEL_LABELS = { basic: "🌱 בסיסי", medium: "⚡ בינוני", advanced: "🚀 מתקדם" };
const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה", "פוקימון", "מינקראפט"];
const EMPTY = { name: "", grade: "כיתה א", level: "medium", special_needs: "", world: "כדורגל" };

async function uploadPhoto(file) {
  if (file.size > 5 * 1024 * 1024) { alert("תמונה גדולה מדי — מקסימום 5MB"); return null; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("child-photos").upload(path, file, { upsert: true });
  if (error) { console.error("photo upload:", error); return null; }
  const { data: { publicUrl } } = supabase.storage.from("child-photos").getPublicUrl(path);
  return publicUrl;
}

function PhotoUploader({ photoUrl, uploading, inputRef, onFileChange, onRemove }) {
  return (
    <div className="flex items-center gap-3">
      <input type="file" ref={inputRef} accept="image/*" onChange={onFileChange} className="hidden" />
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed cursor-pointer overflow-hidden flex items-center justify-center transition-colors ${photoUrl ? "border-grow" : "border-magic/30 hover:border-magic/60"}`}
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-magic border-t-transparent rounded-full animate-spin" />
        ) : photoUrl ? (
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">📷</span>
        )}
      </div>
      <div className="flex-1 text-right">
        {uploading ? (
          <p className="text-xs text-ink/50">טוען תמונה...</p>
        ) : photoUrl ? (
          <div className="flex items-center justify-between">
            <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600 transition-colors">הסר ×</button>
            <p className="text-xs text-grow font-medium">תמונה תופיע בשער ✓</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-ink/50">תמונת פרופיל <span className="text-ink/30">(אופציונלי)</span></p>
            <p className="text-xs text-ink/30">תופיע בשער החוברת</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Students({ onBookletSaved, remaining, isPro }) {
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [photoUrl, setPhotoUrl]   = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const addPhotoRef = useRef(null);
  const [saving, setSaving]       = useState(false);
  const [quickCreate, setQuickCreate] = useState(null);
  const [history, setHistory]         = useState(null);
  const [editId, setEditId]           = useState(null);
  const [editForm, setEditForm]       = useState(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState(null);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const editPhotoRef = useRef(null);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("children")
      .select("*")
      .order("grade")
      .order("name");
    setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    const url = await uploadPhoto(file);
    if (url) setPhotoUrl(url);
    setPhotoUploading(false);
    e.target.value = "";
  };

  const handleEditPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPhotoUploading(true);
    const url = await uploadPhoto(file);
    if (url) setEditPhotoUrl(url);
    setEditPhotoUploading(false);
    e.target.value = "";
  };

  const addStudent = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("children").insert({
      user_id: user.id,
      name: form.name.trim(),
      grade: form.grade,
      level: form.level,
      special_needs: form.special_needs.trim() || null,
      worlds: [form.world],
      photo_url: photoUrl || null,
    });
    setSaving(false);
    setShowAdd(false);
    setForm(EMPTY);
    setPhotoUrl(null);
    fetchStudents();
  };

  const startEdit = (student) => {
    setEditId(student.id);
    setEditForm({
      name: student.name,
      grade: student.grade,
      level: student.level || "medium",
      special_needs: student.special_needs || "",
      world: student.worlds?.[0] || "כדורגל",
    });
    setEditPhotoUrl(student.photo_url || null);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    await supabase.from("children").update({
      name: editForm.name.trim(),
      grade: editForm.grade,
      level: editForm.level,
      special_needs: editForm.special_needs.trim() || null,
      worlds: [editForm.world],
      photo_url: editPhotoUrl || null,
    }).eq("id", editId);
    setSaving(false);
    setEditId(null);
    setEditForm(null);
    setEditPhotoUrl(null);
    fetchStudents();
  };

  const deleteStudent = async (id) => {
    if (!confirm("למחוק את התלמיד/ה?")) return;
    await supabase.from("children").delete().eq("id", id);
    fetchStudents();
  };

  const byGrade = students.reduce((acc, s) => {
    const g = s.grade || "ללא כיתה";
    (acc[g] = acc[g] || []).push(s);
    return acc;
  }, {});

  if (quickCreate) {
    return (
      <QuickCreate
        student={quickCreate}
        onClose={() => setQuickCreate(null)}
        onSaved={() => { setQuickCreate(null); onBookletSaved?.(); }}
        remaining={remaining}
        isPro={isPro}
      />
    );
  }

  if (history) {
    return (
      <StudentHistory
        student={history}
        onBack={() => setHistory(null)}
        remaining={remaining}
        isPro={isPro}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-ink">👥 התלמידים שלי</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-magic text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            + הוסף תלמיד
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-ink/5 space-y-3">
          <h3 className="font-semibold text-ink">הוסף תלמיד/ה</h3>

          <input
            autoFocus
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
            placeholder="שם התלמיד/ה *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />

          <PhotoUploader
            photoUrl={photoUrl}
            uploading={photoUploading}
            inputRef={addPhotoRef}
            onFileChange={handleAddPhoto}
            onRemove={() => setPhotoUrl(null)}
          />

          <select
            className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic"
            value={form.grade}
            onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}
          >
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>

          <div className="flex gap-2">
            {LEVELS.map(([v, t]) => (
              <button
                key={v}
                onClick={() => setForm(p => ({ ...p, level: v }))}
                className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${form.level === v ? "bg-magic text-white border-magic shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-magic/50"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs text-ink/40 mb-1.5 font-medium">עולם תוכן מועדף</p>
            <select
              className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic"
              value={form.world}
              onChange={e => setForm(p => ({ ...p, world: e.target.value }))}
            >
              {WORLDS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          <textarea
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 text-sm"
            placeholder="הערות (אופציונלי) — קשיים, חוזקות, הנחיות מיוחדות..."
            rows={2}
            value={form.special_needs}
            onChange={e => setForm(p => ({ ...p, special_needs: e.target.value }))}
          />

          <div className="flex gap-2">
            <button
              onClick={addStudent}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-magic text-white rounded-xl p-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? "שומר..." : "💾 שמור"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setForm(EMPTY); setPhotoUrl(null); }}
              className="px-5 border border-ink/15 rounded-xl text-ink/50 hover:text-ink transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-12 text-ink/30">טוען...</div>}

      {!loading && students.length === 0 && !showAdd && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-ink/5 text-center space-y-4">
          <div className="text-5xl">👩‍🏫</div>
          <div>
            <p className="font-semibold text-ink">עדיין אין תלמידים שמורים</p>
            <p className="text-ink/40 text-sm mt-1">שמרי תלמיד פעם אחת ואז צרי לו חוברת בלחיצה אחת</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-magic text-white rounded-xl px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
          >
            + הוסף תלמיד ראשון
          </button>
        </div>
      )}

      {/* Student cards grouped by grade */}
      {!loading && Object.entries(byGrade).map(([grade, list]) => (
        <div key={grade} className="space-y-2">
          <p className="text-xs font-semibold text-ink/35 uppercase tracking-wider px-1">{grade} · {list.length} תלמידים</p>
          {list.map(student => (
            <div key={student.id}>
              {editId === student.id ? (
                <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-magic/30 space-y-3">
                  <p className="font-semibold text-ink text-sm">✏️ עריכת {student.name}</p>
                  <input
                    autoFocus
                    className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50 text-sm"
                    value={editForm.name}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="שם *"
                  />
                  <PhotoUploader
                    photoUrl={editPhotoUrl}
                    uploading={editPhotoUploading}
                    inputRef={editPhotoRef}
                    onFileChange={handleEditPhoto}
                    onRemove={() => setEditPhotoUrl(null)}
                  />
                  <select
                    className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic text-sm"
                    value={editForm.grade}
                    onChange={e => setEditForm(p => ({ ...p, grade: e.target.value }))}
                  >
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <div className="flex gap-2">
                    {LEVELS.map(([v, t]) => (
                      <button key={v} onClick={() => setEditForm(p => ({ ...p, level: v }))}
                        className={`flex-1 rounded-xl p-2 text-xs font-medium border transition-colors ${editForm.level === v ? "bg-magic text-white border-magic" : "bg-canvas/50 border-ink/15 text-ink/60"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <select
                    className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic text-sm"
                    value={editForm.world}
                    onChange={e => setEditForm(p => ({ ...p, world: e.target.value }))}
                  >
                    {WORLDS.map(w => <option key={w}>{w}</option>)}
                  </select>
                  <textarea
                    className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 text-xs"
                    placeholder="הערות (אופציונלי)"
                    rows={2}
                    value={editForm.special_needs}
                    onChange={e => setEditForm(p => ({ ...p, special_needs: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving || !editForm.name.trim()}
                      className="flex-1 bg-magic text-white rounded-xl p-2.5 text-sm font-medium disabled:opacity-40 hover:opacity-90">
                      {saving ? "שומר..." : "💾 שמור"}
                    </button>
                    <button onClick={() => { setEditId(null); setEditForm(null); setEditPhotoUrl(null); }}
                      className="px-5 border border-ink/15 rounded-xl text-ink/50 hover:text-ink text-sm">
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-ink/5 flex items-center gap-3">
                  {student.photo_url ? (
                    <img src={student.photo_url} alt={student.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-magic/10 flex items-center justify-center flex-shrink-0 text-magic font-bold text-base">
                      {student.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink">{student.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-ink/40">{LEVEL_LABELS[student.level] || student.level}</span>
                      {student.worlds?.[0] && (
                        <span className="text-xs text-magic/70 bg-magic/8 rounded-full px-2 py-0.5">{student.worlds[0]}</span>
                      )}
                      {student.special_needs && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 cursor-help" title={student.special_needs}>
                          📌 הערות
                        </span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => setHistory(student)}
                    className="border border-ink/15 text-ink/50 rounded-xl px-3 py-2 text-sm hover:text-ink hover:border-ink/30 transition-colors whitespace-nowrap" title="היסטוריה">
                    📅
                  </button>
                  <button onClick={() => startEdit(student)}
                    className="border border-ink/15 text-ink/50 rounded-xl px-3 py-2 text-sm hover:text-magic hover:border-magic/40 transition-colors whitespace-nowrap" title="עריכה">
                    ✏️
                  </button>
                  <button onClick={() => setQuickCreate(student)}
                    className="bg-gradient-to-l from-brand to-magic text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap">
                    ✨ צור
                  </button>
                  <button onClick={() => deleteStudent(student.id)}
                    className="text-ink/20 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0" title="מחק">
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
