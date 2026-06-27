// Brand mark — the real icon (purple book w/ amber spine) instead of a 📚 emoji,
// which renders differently per OS/device and reads as a generic template.
export default function Logo({ size = 28, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="בשבילי"
    >
      <rect width="100" height="100" rx="22" fill="#6C5CE7" />
      <rect x="22" y="16" width="56" height="68" rx="5" fill="white" opacity="0.96" />
      <rect x="22" y="16" width="12" height="68" rx="5" fill="#F4A02C" />
      <rect x="29" y="16" width="5" height="68" fill="#F4A02C" />
      <rect x="40" y="32" width="28" height="3" rx="1.5" fill="#6C5CE7" opacity="0.3" />
      <rect x="40" y="42" width="22" height="3" rx="1.5" fill="#6C5CE7" opacity="0.3" />
      <rect x="40" y="52" width="26" height="3" rx="1.5" fill="#6C5CE7" opacity="0.3" />
      <rect x="40" y="62" width="18" height="3" rx="1.5" fill="#6C5CE7" opacity="0.3" />
    </svg>
  );
}
