import type { TheaterShow } from "@/types";
import { daysAgo, daysAhead } from "./clock";

/**
 * PREVIEW DATA — sample schedule. Setlist names, dates and lineups are
 * invented and are not official theater information.
 */
const VENUE = "JKT48 Theater (sample)";

const desc = {
  cakrawala: "A sample setlist used to preview the show page: sixteen songs, two encores and a unit block in the middle of the running order.",
  orbit: "A sample trainee setlist with a shorter running order, used to preview how trainee shows appear.",
  fajar: "A sample anniversary-style setlist, used to preview long lineups and special-show notes.",
};

export const shows: TheaterShow[] = [
  { slug: "garis-cakrawala-1031", title: "Garis Cakrawala", setlist: "Garis Cakrawala", description: desc.cakrawala, startsAt: daysAgo(6, 19), venue: VENUE, status: "completed", hue: 262,
    lineup: [{ memberSlug: "arunika", role: "center" }, { memberSlug: "kalista" }, { memberSlug: "naira" }, { memberSlug: "ghea" }, { memberSlug: "larasati", role: "unit", unitSong: "Unit song A" }, { memberSlug: "felisha", role: "unit", unitSong: "Unit song A" }, { memberSlug: "cahya" }, { memberSlug: "diandra" }, { memberSlug: "elvaretta" }, { memberSlug: "gendis" }, { memberSlug: "ivana" }, { memberSlug: "tsabita" }] },
  { slug: "lintas-orbit-1032", title: "Lintas Orbit", setlist: "Lintas Orbit", description: desc.orbit, startsAt: daysAgo(4, 14), venue: VENUE, status: "completed", hue: 188,
    lineup: [{ memberSlug: "kirana", role: "center" }, { memberSlug: "jovanka" }, { memberSlug: "mayang" }, { memberSlug: "zahira" }, { memberSlug: "elvaretta" }, { memberSlug: "ivana" }, { memberSlug: "gendis" }, { memberSlug: "diandra" }] },
  { slug: "nada-fajar-1033", title: "Nada Fajar", setlist: "Nada Fajar", description: desc.fajar, startsAt: daysAgo(2, 19), venue: VENUE, status: "completed", hue: 30,
    lineup: [{ memberSlug: "naira", role: "center" }, { memberSlug: "arunika" }, { memberSlug: "tsabita" }, { memberSlug: "larasati" }, { memberSlug: "felisha" }, { memberSlug: "cahya" }, { memberSlug: "ghea" }, { memberSlug: "kalista" }, { memberSlug: "diandra" }, { memberSlug: "ivana" }] },
  { slug: "garis-cakrawala-1034", title: "Garis Cakrawala", setlist: "Garis Cakrawala", description: desc.cakrawala, startsAt: daysAhead(1, 19), venue: VENUE, status: "upcoming", hue: 262,
    lineup: [{ memberSlug: "larasati", role: "center" }, { memberSlug: "kalista" }, { memberSlug: "naira" }, { memberSlug: "ghea" }, { memberSlug: "tsabita" }, { memberSlug: "cahya", role: "unit", unitSong: "Unit song A" }, { memberSlug: "elvaretta", role: "unit", unitSong: "Unit song A" }, { memberSlug: "gendis" }, { memberSlug: "ivana" }, { memberSlug: "diandra" }, { memberSlug: "felisha" }, { memberSlug: "arunika" }] },
  { slug: "lintas-orbit-1035", title: "Lintas Orbit", setlist: "Lintas Orbit", description: desc.orbit, startsAt: daysAhead(2, 14), venue: VENUE, status: "upcoming", hue: 188,
    lineup: [{ memberSlug: "jovanka", role: "center" }, { memberSlug: "kirana" }, { memberSlug: "mayang" }, { memberSlug: "zahira" }, { memberSlug: "gendis" }, { memberSlug: "diandra" }, { memberSlug: "elvaretta" }, { memberSlug: "ivana" }] },
  { slug: "nada-fajar-1036", title: "Nada Fajar", setlist: "Nada Fajar", description: desc.fajar, startsAt: daysAhead(2, 19), venue: VENUE, status: "upcoming", hue: 30,
    lineup: [{ memberSlug: "tsabita", role: "center" }, { memberSlug: "arunika" }, { memberSlug: "kalista" }, { memberSlug: "naira" }, { memberSlug: "felisha" }, { memberSlug: "larasati" }, { memberSlug: "cahya" }, { memberSlug: "ghea" }, { memberSlug: "ivana" }, { memberSlug: "elvaretta" }] },
  { slug: "garis-cakrawala-1037", title: "Garis Cakrawala", setlist: "Garis Cakrawala", description: desc.cakrawala, startsAt: daysAhead(4, 19), venue: VENUE, status: "upcoming", hue: 262, lineup: [],
    note: "Lineup not announced yet in the sample schedule." },
  { slug: "lintas-orbit-1038", title: "Lintas Orbit", setlist: "Lintas Orbit", description: desc.orbit, startsAt: daysAhead(5, 19), venue: VENUE, status: "cancelled", hue: 188,
    lineup: [{ memberSlug: "jovanka" }, { memberSlug: "kirana" }, { memberSlug: "mayang" }, { memberSlug: "zahira" }],
    note: "Sample cancellation, used to preview the cancelled state." },
  { slug: "nada-fajar-1039", title: "Nada Fajar", setlist: "Nada Fajar", description: desc.fajar, startsAt: daysAhead(7, 19), venue: VENUE, status: "upcoming", hue: 30,
    lineup: [{ memberSlug: "naira", role: "center" }, { memberSlug: "ghea" }, { memberSlug: "kalista" }, { memberSlug: "larasati" }, { memberSlug: "diandra" }, { memberSlug: "ivana" }, { memberSlug: "felisha" }, { memberSlug: "tsabita" }] },
];
