/** Theatre drapes framing the stage; `open` draws them aside. */
export function Curtain({ open }: { open?: boolean }) {
  return (
    <div className={`ps-curtain${open ? " is-open" : ""}`} aria-hidden>
      <span className="ps-curtain__l" />
      <span className="ps-curtain__r" />
      <span className="ps-curtain__valance" />
    </div>
  );
}
