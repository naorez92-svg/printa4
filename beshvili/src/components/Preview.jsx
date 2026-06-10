export default function Preview({ html }) {
  const openPrint = () => {
    const w = window.open();
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-2">
      <iframe
        title="preview"
        srcDoc={html}
        className="w-full h-[600px] border border-ink/10 rounded-xl bg-white"
        sandbox="allow-same-origin allow-scripts"
      />
      <button
        onClick={openPrint}
        className="w-full bg-grow text-white rounded-xl p-3 font-display font-semibold hover:bg-grow/90 transition-colors"
      >
        🖨️ פתח להדפסה
      </button>
    </div>
  );
}
