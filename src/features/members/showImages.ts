/**
 * Banner art for the theater shows sold in the dashboard, keyed by show
 * title (matched case- and punctuation-insensitively, by prefix so that
 * "passion 200" also covers "PASSION 200%"). These direct URLs win over
 * every other source. Paths under /media/cdn/ load from the upstream image
 * CDN through this site's image proxy (worker/handlers.ts).
 */
const SHOW_IMAGES_MAP: Record<string, { banner: string; poster: string }> = {
  "cara meminum ramune": {
    banner: "https://replay.gstreamlive.com/texture-lab-1779700974320.png",
    poster: "/media/cdn/jkt48/theater/uploads/nixg3rixpjpom3xa0ivf.jpg",
  },
  "pertaruhan cinta": {
    banner: "https://replay.gstreamlive.com/texture-lab-1779699993596.png",
    poster: "https://replay.gstreamlive.com/texture-lab-1779700892394.png",
  },
  "sambil menggandeng erat tanganku": {
    banner: "/media/cdn/jkt48/theater/uploads/zjdka1gtuuoc5gx9kkco.jpg",
    poster: "/media/cdn/jkt48/theater/content-images/post/20260201/50a27780-93e7-4e40-8474-60f6e0cca6da-260201195806.jpg",
  },
  "pajama drive": {
    banner: "/media/cdn/jkt48/theater/uploads/ud3mb6r76obaftx4snzy.jpg",
    poster: "/media/cdn/jkt48/theater/uploads/xspjxcs9wwm9jxwhiy5q.jpg",
  },
  "passion 200": {
    banner: "/media/cdn/jkt48/theater/uploads/y2g3dgukgk8ohxghfxv8lyju.jpg",
    poster: "/media/cdn/jkt48/theater/uploads/cu0wq736nhcstg0epmiieumc.jpg",
  },
  "dream bakudan": {
    banner: "/media/cdn/jkt48/theater/uploads/vtkqhjbmjch7dzr29rd1ju4u.jpg",
    poster: "/media/cdn/jkt48/theater/uploads/mm75j8ahpv6o3t6as7zs6izh.jpg",
  },
  itadaki: {
    banner: "/media/cdn/jkt48/theater/uploads/cq0m6aj6ajj3efolbqtlur0d.jpg",
    poster: "/media/cdn/jkt48/theater/uploads/enw9vf2j9cnszyqv0ej81ykt.jpg",
  },
};

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
const ENTRIES = Object.entries(SHOW_IMAGES_MAP)
  .map(([title, art]) => [key(title), art.banner] as const)
  // Longest name first, so a longer title is never shadowed by a shorter prefix.
  .sort((a, b) => b[0].length - a[0].length);

/** The banner for a show title, or undefined when the map has none. */
export function bannerFor(title: string): string | undefined {
  const k = key(title);
  return ENTRIES.find(([name]) => k.startsWith(name))?.[1];
}
