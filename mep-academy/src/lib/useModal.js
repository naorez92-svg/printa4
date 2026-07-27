import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// התנהגות דיאלוג מלאה שחסרה ל-role="dialog" לבד:
// 1. מלכודת פוקוס — Tab לא בורח לתוכן שמוסתר מאחורי המודל (aria-modal מבטיח
//    את זה לקוראי מסך; המלכודת מבטיחה את זה גם למקלדת).
// 2. החזרת הפוקוס לאלמנט שפתח את הדיאלוג בסגירה.
// 3. נעילת גלילת הרקע — גרירה על השכבה לא מגלגלת את הדף שמתחת.
export function useModal(dialogRef) {
  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // האלמנט שפתח עשוי להיעלם (החלפת מסך) — מחזירים פוקוס רק אם הוא עדיין בעמוד
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [dialogRef]);
}
