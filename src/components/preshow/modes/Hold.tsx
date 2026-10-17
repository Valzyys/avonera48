/** The start time has passed but the stream isn't up yet: wait calmly; it switches by itself. */
export function Hold() {
  return (
    <div className="ps-mode ps-hold">
      <span className="ps-loader" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <h2 className="ps-hold__title">SEBENTAR LAGI SIARAN DIMULAI</h2>
      <p className="ps-hold__note">Mohon tunggu, siaran akan tampil otomatis</p>
    </div>
  );
}
