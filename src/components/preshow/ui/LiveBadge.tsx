export function LiveBadge({ label = "PRE-SHOW" }: { label?: string }) {
  return (
    <span className="ps-badge">
      <i aria-hidden />
      {label}
    </span>
  );
}
