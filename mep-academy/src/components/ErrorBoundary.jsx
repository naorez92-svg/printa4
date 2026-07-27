import { Component } from "react";

// רשת חלשה + chunk עצל שנכשל בטעינה = חריגה בזמן רינדור. בלי הגבול הזה
// React 18 מפרק את כל העץ ומשאיר מסך לבן; איתו — הודעה ידידותית וכפתור
// ניסיון חוזר שמאלץ mount מחדש (וניסיון fetch חדש) של התוכן שנכשל.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4" role="alert">
        <p className="text-4xl" aria-hidden>📡</p>
        <p className="font-bold">התוכן לא נטען</p>
        <p className="text-sm text-ink/70">בדקו את החיבור לרשת ונסו שוב.</p>
        <button
          onClick={this.retry}
          className="bg-magic text-white rounded-2xl px-8 py-3 font-bold hover:opacity-90"
        >
          ניסיון חוזר
        </button>
      </div>
    );
  }
}
