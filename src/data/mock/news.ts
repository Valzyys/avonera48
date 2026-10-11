import type { NewsArticle } from "@/types";
import { daysAgo } from "./clock";

/**
 * PREVIEW DATA — placeholder articles. These are not official announcements
 * and contain no statements attributed to JKT48 or its members.
 */
const lorem = [
  "This is placeholder copy used to preview how an article reads on Avonera48. When a verified news source is connected, the original text, publication date and a link to the source will replace it.",
  "Articles can reference members, so readers can jump straight to a profile, see related theater shows and catch up on recent streams from the same people.",
  "The layout supports long-form paragraphs, a featured image area and related members at the end of the story.",
];

export const news: NewsArticle[] = [
  { slug: "november-setlist-rotation", title: "Sample: setlist rotation planned for next month", category: "Theater", publishedAt: daysAgo(1, 10), featured: true, hue: 262,
    summary: "Placeholder article previewing how theater news is presented, with related members linked at the end.", body: lorem, relatedMemberSlugs: ["arunika", "naira", "larasati"] },
  { slug: "trainee-showcase-recap", title: "Sample: trainee showcase recap", category: "Event", publishedAt: daysAgo(3, 18), hue: 160,
    summary: "Placeholder recap article linked to the Generation 13 trainees.", body: lorem, relatedMemberSlugs: ["jovanka", "kirana", "mayang", "zahira"] },
  { slug: "digital-single-window", title: "Sample: digital single release window", category: "Release", publishedAt: daysAgo(5, 9), hue: 30,
    summary: "Placeholder release article. Titles and dates in the preview are fictional.", body: lorem, relatedMemberSlugs: ["kalista", "larasati"] },
  { slug: "ticketing-schedule-update", title: "Sample: theater ticketing schedule update", category: "Announcement", publishedAt: daysAgo(8, 12), hue: 205,
    summary: "Placeholder announcement previewing the announcement category.", body: lorem, relatedMemberSlugs: [] },
  { slug: "anniversary-stage-photos", title: "Sample: anniversary stage photo set", category: "Event", publishedAt: daysAgo(12, 15), hue: 330,
    summary: "Placeholder article with a longer list of related members.", body: lorem, relatedMemberSlugs: ["ghea", "cahya", "felisha", "tsabita"] },
  { slug: "streaming-week-highlights", title: "Sample: streaming week highlights", category: "Announcement", publishedAt: daysAgo(15, 20), hue: 188,
    summary: "Placeholder roundup showing how stream-related news links to member pages.", body: lorem, relatedMemberSlugs: ["naira", "elvaretta", "cahya"] },
];
