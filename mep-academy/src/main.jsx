import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// אופליין: אחרי ביקור אחד עם רשת האפליקציה כולה עובדת בלי קליטה
// (אתר בנייה, חניון, ממ"ד). נרשם אחרי הטעינה כדי לא להתחרות בנתיב הקריטי.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
