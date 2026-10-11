import type { Team } from "@/types";

/* Accent per team — a design choice for this site, not an official colour. */
const TEAM_COLOR: Record<Team, string> = {
  LOVE: "#e5679c",
  DREAM: "#4b8fe2",
  PASSION: "#ef7a3c",
  TRAINEE: "#3aa877",
  JKT48: "#c9374f",
};
const TEAMS = Object.keys(TEAM_COLOR) as Team[];

export const asTeam = (t: string): Team => (TEAMS.includes(t as Team) ? (t as Team) : "JKT48");
export const teamColor = (t: string) => TEAM_COLOR[asTeam(t)];
export const teamLabel = (t: string) => {
  const team = asTeam(t);
  return team === "JKT48" ? "JKT48" : team === "TRAINEE" ? "Trainee" : `Team ${team[0]}${team.slice(1).toLowerCase()}`;
};
