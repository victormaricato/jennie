// JENNIE DNA mark in the GLOF-paper palette: orange + green strands, grey rungs.
export function JennieLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* orange strand (LOF) */}
      <path d="M7 3C7 7 17 9 17 12C17 15 7 17 7 21"
            stroke="#e07b39" strokeWidth="2" strokeLinecap="round" />
      {/* green strand (GOF) */}
      <path d="M17 3C17 7 7 9 7 12C7 15 17 17 17 21"
            stroke="#2a9d8f" strokeWidth="2" strokeLinecap="round" />
      {/* grey rungs (NEUTRAL) */}
      <line x1="9" y1="5.4" x2="15" y2="5.4" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="18.6" x2="15" y2="18.6" stroke="#999999" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
