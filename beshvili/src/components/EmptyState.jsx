// Shared empty-state block — an illustrated placeholder shown when a list has no
// items yet (History, Students, Jewish). Replaces bare "אין עדיין…" text with a
// branded icon, a clear line of copy, and an optional primary action. Keep it
// presentational: callers own the data check and pass an onAction handler.
export default function EmptyState({ emoji = "📄", title, subtitle, actionLabel, onAction }) {
  return (
    <div className="text-center py-12 px-5">
      <div className="mx-auto mb-4 w-20 h-20 rounded-3xl bg-gradient-to-br from-magic/12 to-brand/12 border border-magic/15 flex items-center justify-center text-4xl">
        {emoji}
      </div>
      <p className="font-display font-bold text-ink text-lg">{title}</p>
      {subtitle && <p className="text-sm text-ink/50 mt-1.5 max-w-xs mx-auto leading-relaxed">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-block mt-5 bg-gradient-to-l from-brand to-magic text-white rounded-xl px-6 py-2.5 text-sm font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
