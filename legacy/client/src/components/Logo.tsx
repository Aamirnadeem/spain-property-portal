export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Barcelona Property Explorer"
      role="img"
    >
      {/* Hillside/skyline silhouette over a horizon line — city, coast, hillside in one mark */}
      <path
        d="M2 22 L8 12 L11 16 L15 8 L19 15 L22 11 L26 18 L30 22"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <line x1="2" y1="26" x2="30" y2="26" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="24" cy="7" r="2.25" fill="currentColor" />
    </svg>
  );
}
