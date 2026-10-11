import type { ApiTheater } from "./types";

const I = (id: string) => `/media/api/img/i/${id}.jpg`;
const L = (...rows: [string, string, string][]) => rows.map(([id, name, url_key]) => ({ id, name, url_key }));

/** Snapshot of GET /api/v1/theater?page=1 (cached_at 2026-10-11T05:03:43Z). */
export const theaterResponse: ApiTheater[] = [
  {
    date: "2026-10-11", title: "PASSION 200%", start_time: "19:00", end_time: "21:00", reference_code: "SH4A49", jkt48_member_type: "PASSION", is_birthday_show: false,
    banner: I("bwc7ek3ebzflssncml77wozmjo7rtycaq42dksqldjsxk6w2stcypwghcua7urla2obee7jqdcqbljrvhjv3a7eq4y4xkqaiyr5e2337qryorxq"),
    poster: I("4dyqo2eoqo64idfxnyg57iclwgcyll7p7puj77pln7lifedv7jpgo5h7rp64kxxd2eyirhdkgynaezmqaybg2ikepfrhtw6clydbafmpwbnysty"),
    lineup: L(["22", "Angelina Christy", "angelina-christy"], ["59", "Cornelia Vanisa", "cornelia-vanisa"], ["64", "Dena Natalia", "dena-natalia"], ["67", "Desy Natalia", "desy-natalia"], ["89", "Feni Fitriyanti", "feni-fitriyanti"], ["127", "Jessica Chandra", "jessica-chandra"], ["148", "Lulu Salsabila", "lulu-salsabila"], ["161", "Michelle Levia", "michelle-levia"], ["166", "Mutiara Azzahra", "mutiara-azzahra"], ["195", "Raisha Syifa", "raisha-syifa"], ["204", "Ribka Budiman", "ribka-budiman"], ["244", "Victoria Kimberly", "victoria-kimberly"]),
  },
  {
    date: "2026-10-16", title: "Pajama Drive", start_time: "19:00", end_time: "21:00", reference_code: "SH6B09", jkt48_member_type: "TRAINEE", is_birthday_show: false,
    banner: I("d7mvpfi2jg5siqjrctcovbwio5elhdd664362b6k7jbn66wnucewo6nlifc6eajmfjsi7o7lwnd35yau6xawpuiswcmgq772vylvu6cn7jwb4jsc"),
    poster: I("gyd6q6j2quo5j6czaxcpqo3qvb2nv2cuu75vvrqdrlwdd3eka2wrqohlx4jixsjtdoai642ixmerceadvq4mwop3m3lvuahatfltzeyokavsyjcb"),
    lineup: [],
  },
  {
    date: "2026-10-17", title: "DREAM BAKUDAN", start_time: "14:00", end_time: "16:00", reference_code: "SH8A81", jkt48_member_type: "DREAM", is_birthday_show: true,
    banner: I("qo4zij5n5tv2aqdd5rukbkx75j7xx2cnhhu4v3dgyacgldpgkxjsbtckywyetf4b6c4e7kfzvuwqxivsd7osz23j56zzlgyb53ygx7x3uzo2pdrdce"),
    poster: I("cfeoo4gtuikerxr66xhe44zwbhxsm2yleakvrymuxorcjd6x4r3frzzmvoihavoiuthmg6ggzal3wu45pkzevp4zv3fwxmfetmik77pqzynct2ruym"),
    lineup: L(["178", "Nina Tutachia", "nina-tutachia"]),
  },
  {
    date: "2026-10-17", title: "Sambil Menggandeng Erat Tanganku", start_time: "19:00", end_time: "21:00", reference_code: "SH2892", jkt48_member_type: "PASSION", is_birthday_show: false,
    banner: I("f57txgz3l2nbiobi4s72ra25foiu4olkuoe2d7646hd6braluqvnuovs5dhcbf5aynn66yqwfcqg7fqvwltic6q72vuikbhceog7wxlqzlctvq7gh54rr5au7nd57a2hxxrra3oyz7heluk6"),
    poster: I("scswlqul34gzf547hl3bf5gclf266e4v7xalashjsfnvwme7nwwninkimrmv6ojrovmtpl6wpsk54cdyzi53ve7d4d6ijhc5dtxopv2udnzbpokrwansi4ll44ywat3bxikny5xpeash2rjg"),
    lineup: [],
  },
  {
    date: "2026-10-18", title: "Pertaruhan Cinta", start_time: "14:00", end_time: "16:00", reference_code: "SH06BC", jkt48_member_type: "JKT48", is_birthday_show: true,
    banner: I("mtpwjd4ab4ey2esibnqvwj64s7pjysfdxfeldgggihcyv75ac22br4asvr6ylfjci3h3slbzaeeeoyemiqigjphtryhph2yetk352kcnqp2vpn6xigc2mci"),
    poster: I("6yddvqcmky4jl2cjgnhxbe7dnpny3y4kuydiphj2exbnqzz5up6gxbqdvcq62de4jcau7w5uugmixzvdrr5sdkrex6xf3ojiag6yjgitzuyqy4heqzu4zlq"),
    lineup: L(["26", "Anindya Ramadhani", "anindya-ramadhani"]),
  },
  {
    date: "2026-10-18", title: "ITADAKI♥LOVE", start_time: "19:00", end_time: "21:00", reference_code: "SHCD32", jkt48_member_type: "LOVE", is_birthday_show: true,
    banner: I("g6zl2zubiezuhg2buze3zwhjh2rn6kpg6qomwaf7ddlcmsd7wekgjndbqtzs7dw2kndu3f2vxwqntl2ex4xaqun735kb77vhcgkhg6kemtmbrdq"),
    poster: I("ax6kowymglsr5ifscdif56gwndc6rqmnj6nijjrvupxy63faenbylbyorkw4astvtib4navyust3ynpkwg723xdt3ronrcpihupniqiycwuwhsy"),
    lineup: L(["105", "Grace Octaviani", "grace-octaviani"]),
  },
];
