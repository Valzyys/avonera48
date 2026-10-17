/** Static pre-show settings. Nothing here is show data: that all comes from the API. */
export type RuleIcon = "no-record" | "chat" | "no-spam" | "wifi";

export const preshowConfig = {
  /** Text only (ticker and voice), never a logo. */
  brandName: "Avonera48",
  colors: {
    bg: "#07060B",
    surface: "#14111C",
    primary: "#E8457A",
    accent: "#F6C453",
    text: "#F5F3FA",
    muted: "#9A93AD",
  },
  rules: [
    { icon: "no-record", text: "Dilarang merekam / restream tayangan" },
    { icon: "chat", text: "Jaga chat tetap sopan & positif" },
    { icon: "no-spam", text: "Tidak spam, tidak promosi" },
    { icon: "wifi", text: "Gunakan koneksi stabil untuk kualitas terbaik" },
  ] as { icon: RuleIcon; text: string }[],
  /** Image URLs of partner logos; empty skips the Partner scene. */
  sponsors: [] as { name: string; logoUrl: string }[],
  /** Social handles; empty skips the Connect scene. */
  socials: [] as { platform: "instagram" | "x" | "tiktok" | "youtube" | "whatsapp"; handle: string }[],
  ticker: ["Selamat datang di Avonera48", "Show akan segera dimulai — stay tuned!", "Dilarang merekam & menyebarkan ulang tayangan"],
  /** Seconds before the start when the loop gives way to the big countdown. */
  finalCountdownSeconds: 300,
  /** Loop length in seconds (the main BGM is cut to exactly this). */
  loopSeconds: 150,
};
