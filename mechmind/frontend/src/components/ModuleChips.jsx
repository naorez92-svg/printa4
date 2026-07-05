const MODULES = [
  {
    id: 'M-05', icon: '📐', name: 'קורא שרטוטים', upload: true,
  },
  {
    id: 'M-01', icon: '🧊', name: 'סטודיו שרטוט',
    template: 'בנה לי מודל של פלטת בסיס מאלומיניום 6061 בגודל 120×80×10 מ"מ עם 4 חורי M8 בפינות, 12 מ"מ מכל שפה',
  },
  {
    id: 'M-02', icon: '🏗️', name: 'בדיקת חוזק',
    template: 'האם קורת פלדה S235 באורך 2 מטר, חתך מלבני 40×80 מ"מ, נסמכת בשני הקצוות, תחזיק כוח מרוכז של 500 ק"ג במרכז?',
  },
  {
    id: 'M-03', icon: '🧪', name: 'יועץ חומרים',
    template: 'איזה חומר מתאים לזרוע קלה שנדרשת לחוזק כניעה מעל 250 MPa, סביבה חיצונית, ותקציב עד 40 ₪ לק"ג?',
  },
  {
    id: 'M-04', icon: '🏭', name: 'תכנון ייצור',
    template: 'איך הכי משתלם לייצר 200 יחידות של תושבת אלומיניום 6061 פריזמטית בנפח 45 סמ"ק, וכמה זה יעלה?',
  },
  {
    id: 'M-06', icon: '📋', name: 'תרגום לפרויקט',
    template: 'בנה לי תוכנית פרויקט ומפרט RFQ לספק עבור ייצור 200 תושבות אלומיניום כולל אנודייז, הרכבה ובדיקת איכות',
  },
]

export default function ModuleChips({ onTemplate, onUpload }) {
  return (
    <div className="flex gap-2 px-6 py-2.5 border-b border-line bg-panel/50 overflow-x-auto shrink-0">
      {MODULES.map((m) => (
        <button
          key={m.id}
          onClick={() => (m.upload ? onUpload() : onTemplate(m.template))}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap rounded-full border border-line
                     bg-panel px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
          title={m.template || 'העלאת קובץ שרטוט'}
        >
          <span>{m.icon}</span>
          <span className="font-medium">{m.name}</span>
          <span className="text-slate-500">{m.id}</span>
        </button>
      ))}
    </div>
  )
}
