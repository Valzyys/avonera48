import type { Generation, Member } from "@/types";

/**
 * PREVIEW DATA — fictional members. Names, profiles and tags are invented
 * for the UI phase and do not describe real people.
 */
export const generations: Generation[] = [
  { number: 9, label: "Generation 9" },
  { number: 10, label: "Generation 10" },
  { number: 11, label: "Generation 11" },
  { number: 12, label: "Generation 12" },
  { number: 13, label: "Generation 13" },
];

type Seed = [slug: string, name: string, nickname: string, gen: number, status: Member["status"], hue: number, tags: string[], birthday: string];

const seeds: Seed[] = [
  ["arunika", "Arunika Wirasena", "Runi", 9, "active", 262, ["MC", "Vocal"], "2003-10-14"],
  ["kalista", "Kalista Pramudita", "Lista", 9, "active", 188, ["Dance"], "2004-02-03"],
  ["sekar", "Sekar Ayudhia", "Sekar", 9, "graduated", 330, ["Vocal"], "2002-07-22"],
  ["naira", "Naira Lestanti", "Nai", 10, "active", 205, ["Streaming", "Vocal"], "2005-10-12"],
  ["ghea", "Ghea Maharani", "Ghea", 10, "active", 12, ["Dance", "Variety"], "2004-12-29"],
  ["tsabita", "Tsabita Kirana", "Tsabi", 10, "active", 150, ["Streaming"], "2006-04-08"],
  ["larasati", "Larasati Hapsari", "Laras", 11, "active", 280, ["MC", "Variety"], "2006-10-19"],
  ["felisha", "Felisha Andarini", "Feli", 11, "active", 45, ["Dance"], "2005-08-11"],
  ["cahya", "Cahya Pertiwi", "Aya", 11, "active", 170, ["Cooking", "Streaming"], "2007-01-25"],
  ["ravena", "Ravena Sukmawati", "Rave", 11, "graduated", 300, ["Dance"], "2004-05-30"],
  ["diandra", "Diandra Kusuma", "Dian", 12, "active", 220, ["Vocal"], "2007-03-17"],
  ["elvaretta", "Elvaretta Nayaka", "Elva", 12, "active", 250, ["Streaming", "Variety"], "2008-10-24"],
  ["gendis", "Gendis Purbasari", "Gendis", 12, "active", 20, ["Dance"], "2007-11-02"],
  ["ivana", "Ivana Rahmadita", "Ivy", 12, "active", 195, ["Vocal", "MC"], "2008-06-13"],
  ["jovanka", "Jovanka Srikandi", "Jova", 13, "trainee", 160, ["Dance"], "2009-11-07"],
  ["kirana", "Kirana Anindya", "Kira", 13, "trainee", 275, ["Streaming"], "2009-01-19"],
  ["mayang", "Mayang Sarirasa", "Mayang", 13, "trainee", 340, ["Vocal"], "2010-10-30"],
  ["zahira", "Zahira Prameswari", "Zahi", 13, "trainee", 60, ["Variety"], "2009-08-05"],
];

const debutYear: Record<number, number> = { 9: 2020, 10: 2021, 11: 2022, 12: 2023, 13: 2025 };

/** Fictional penlight (oshi) colors for the preview. */
const oshiColor: Record<string, string> = {
  arunika: "#ff4f8b",
  kalista: "#3d8bff",
  sekar: "#9b8cff",
  naira: "#ff8a3d",
  ghea: "#e8455a",
  tsabita: "#14b8a6",
  larasati: "#a259ff",
  felisha: "#f5b700",
  cahya: "#22c55e",
  ravena: "#94a3b8",
  diandra: "#06b6d4",
  elvaretta: "#ff6fb5",
  gendis: "#84cc16",
  ivana: "#6366f1",
  jovanka: "#fb923c",
  kirana: "#ec4899",
  mayang: "#0ea5e9",
  zahira: "#65a30d",
};

export const members: Member[] = seeds.map(([slug, name, nickname, generation, status, hue, tags, birthday]) => ({
  slug,
  name,
  nickname,
  generation,
  status,
  hue,
  color: oshiColor[slug],
  tags,
  birthday,
  joinedYear: debutYear[generation],
  bio: `${nickname} is a placeholder profile in the Avonera48 preview dataset. Real profile information will appear here once a verified data source is connected.`,
}));
