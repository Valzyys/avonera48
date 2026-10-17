import { PsIcon } from "./Icons";

/** Bottom-left: the pre-show starts silent; one tap turns the sound on. */
export function SoundToggle({ on, loading, onToggle }: { on: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`ps-sound${on ? " is-on" : ""}`} aria-pressed={on} aria-label={on ? "Matikan suara" : "Nyalakan suara"} onClick={onToggle} disabled={loading}>
      <PsIcon name={on ? "sound-on" : "sound-off"} size="1.25em" />
      <span>{loading ? "Memuat suara…" : on ? "Suara aktif" : "Ketuk untuk suara"}</span>
    </button>
  );
}
