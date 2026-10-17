/** Something's off with the stream status: hold the screen, nothing loud. */
export function Standby() {
  return (
    <div className="ps-mode ps-standby">
      <span className="ps-orbit" aria-hidden>
        <i />
      </span>
      <h2 className="ps-hold__title">MOHON TUNGGU SEBENTAR</h2>
      <p className="ps-hold__note">Kami sedang menyiapkan tayangan terbaik untukmu</p>
    </div>
  );
}
