export function PageFallback() {
  return (
    <div className="page-fallback" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
