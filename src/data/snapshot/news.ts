import type { ApiNews } from "./types";

const N = (id: string, slug: string, date: string, category: string, title: string): ApiNews => ({ id, slug, date, category, title, url: `https://jkt48.com/news/${slug}` });

/** Snapshot of GET /api/v1/news. Titles and links point to the official source. */
export const newsResponse: ApiNews[] = [
  N("1876", "pengumuman-mengenai-pre-order-jkt48-digital-photobook-smiles-come-to-you-dengan-bonus-video-call-wit", "2026-10-09T17:00:00.000Z", "Theater", "Pengumuman Mengenai Pre-Order JKT48 Digital Photobook “Smiles Come to You” dengan bonus Video Call with JKT48"),
  N("1874", "pengumuman-mengenai-donasi-jkt48-untuk-korban-bencana-di-indonesia", "2026-10-06T17:00:00.000Z", "Theater", "Pengumuman Mengenai Donasi JKT48 untuk Korban Bencana di Indonesia"),
  N("1873", "pengumuman-mengenai-pertunjukan-teater-pajama-drive-11-oktober-2026", "2026-10-02T17:00:00.000Z", "Theater", "Pengumuman Mengenai Pertunjukan Teater Pajama Drive 11 Oktober 2026"),
  N("1872", "pengumuman-mengenai-aktivitas-feni-fitriyanti-di-jkt48", "2026-09-29T18:00:00.000Z", "Other", "Pengumuman Mengenai Aktivitas Feni Fitriyanti di JKT48"),
  N("1871", "pengumuman-mengenai-video-call-pengganti-gabriela-abigail-dan-lulu-salsabila", "2026-09-23T17:00:00.000Z", "Theater", "Pengumuman Mengenai Video Call Pengganti Gabriela Abigail dan Lulu Salsabila"),
  N("1870", "pengumuman-mengenai-kategori-tiket-baru-jkt48-theater-far-dan-jkt48-theater-first-experience-campaig", "2026-09-20T17:00:00.000Z", "Theater", "Pengumuman Mengenai Kategori Tiket Baru JKT48 Theater: FAR dan JKT48 Theater First Experience Campaign"),
  N("1869", "pengumuman-mengenai-partisipasi-fans-dalam-music-video-shooting-single-ke-28-ayo-senyumlah", "2026-09-16T17:00:00.000Z", "Theater", "Pengumuman Mengenai Partisipasi Fans dalam Music Video Shooting Single ke-28 “Ayo Senyumlah”"),
  N("1867", "pengumuman-mengenai-peraturan-jkt48-akb48-personal-meet-and-greet-festival-ayo-senyumlah", "2026-09-12T01:00:00.000Z", "Event", "Pengumuman Mengenai Peraturan JKT48 & AKB48 Personal Meet and Greet Festival “Ayo Senyumlah”"),
  N("1868", "pengumuman-mengenai-jadwal-penjualan-timetable-jkt48-akb48-personal-meet-greet-festival-ayo-senyumla", "2026-09-11T17:00:00.000Z", "Event", "Pengumuman Mengenai Jadwal Penjualan & Timetable JKT48 & AKB48 Personal Meet & Greet Festival “Ayo Senyumlah”"),
  N("1866", "pengumuman-mengenai-pre-order-jkt48-digital-photobook-cheerful-little-wishes-dengan-bonus-video-call", "2026-09-06T17:00:00.000Z", "Theater", "Pengumuman Mengenai Pre-Order JKT48 Digital Photobook “Cheerful Little Wishes” dengan bonus Video Call with JKT48"),
];
