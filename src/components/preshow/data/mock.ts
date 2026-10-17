import type { PreShowData, PreShowMember } from "./types";

const NAMES = [
  ["Christy", "Angelina Christy"], ["Oniel", "Cornelia Vanisa"], ["Feni", "Feni Fitriyanti"], ["Gita", "Gita Sekar Andarini"],
  ["Marsha", "Marsha Lenathea Lapian"], ["Zee", "Azizi Asadel"], ["Freya", "Freyanashifa Jayawardana"], ["Flora", "Flora Shafiq"],
  ["Adel", "Adeline Wijaya"], ["Lulu", "Lulu Salsabila"], ["Indah", "Indah Cahya Nabilla"], ["Jessi", "Jessica Chandra"],
  ["Kathrina", "Kathrina Irene"], ["Muthe", "Mutiara Azzahra"], ["Olla", "Olla Sutanto"], ["Raisha", "Raisha Syifa Wardhana"],
  ["Cathy", "Cathleen Nixie"], ["Elin", "Elin Maharani"], ["Gendis", "Gendis Mayrannisa"], ["Lia", "Aurellia"],
  ["Trisha", "Trisha Arifin"], ["Alya", "Alya Amanda"], ["Anindya", "Anindya Ramadhani"], ["Callie", "Callista Alifia"],
  ["Daisy", "Daisy Hapsari"], ["Danella", "Danella Azzahra"], ["Ella", "Gabriela Abigail"], ["Grace", "Grace Octaviani"],
  ["Michie", "Michelle Alexandra"], ["Nala", "Nayla Suji"],
];

/** Mock members; every third one has no photo (to see the fallback). */
export function mockMembers(n: number): PreShowMember[] {
  return Array.from({ length: n }, (_, i) => {
    const [nickname, name] = NAMES[i % NAMES.length];
    return { name: i >= NAMES.length ? `${name} ${Math.floor(i / NAMES.length) + 1}` : name, nickname, photoUrl: i % 3 === 2 ? undefined : `https://picsum.photos/seed/avonera${i}/320/400` };
  });
}

/**
 * ?mock=1 (long setlist, 16 members), ?mock=bare (no setlist or date),
 * and &members=N for any lineup size (0 hides the lineup).
 */
export function mockShow(kind: string, members: number | null, startAt?: Date): PreShowData {
  const n = members ?? 16;
  if (kind === "bare") return { members: mockMembers(n) };
  return {
    setlist: "Sambil Menggandeng Erat Tanganku — Special Anniversary Performance",
    team: "Team Passion",
    startAt: startAt ?? new Date(Date.now() + 42 * 60_000),
    special: "Birthday show · Gita",
    members: mockMembers(n),
  };
}
