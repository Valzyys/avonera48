import type { ApiBirthday } from "./types";

const B = (name: string, url_key: string, birthdate: string, id: string, ext = "jpg"): ApiBirthday => ({ name, url_key, birthdate, img: `/media/api/img/i/${id}.${ext}` });

/** Snapshot of GET /api/v1/birthday. The date part of `birthdate` is the birthday (the source pairs it with `next_birthday` on that same date). */
export const birthdayResponse: ApiBirthday[] = [
  B("Sami", "sami", "2009-10-06T17:00:00.000Z", "bmk4ldbhhnrqkl2komfon7kwcspb6fv2mv2fvo2s4tr5hn44nzzqri7d42n6qmn45ruvjsy6z3jx5atci7kyxesuclzlmy4snjvagjgqil4ffwkw5kfhgrogtfcnywqt", "png"),
  B("Ralyne", "ralyne", "2011-10-14T17:00:00.000Z", "tkl4qs67ztobvtkvje3h5cbgp6qhlvwkl5vad2lqu6rt4nta6iukuopzm5zun3tir6d5sbyzh6lfzdgpqkpobhbgmtdk2lal35shr52zctg7bab5bhtb3rxwpxv6avse"),
  B("Nachia", "nachia", "2009-10-15T17:00:00.000Z", "qtqalrsz6ie64kx5mpbc5ylrepid6ei4sw7pbd5sp3alaxuaqodatmyxcovxb5xcti4uhebhjbsbkfbwtwtgweglobnzrky5vadgsvtdz5r2pgng6a6uinmywu66faxo"),
  B("Anindya", "anindya", "2005-10-17T17:00:00.000Z", "5altjeytmtxhlomt3e6jbwg7yt6nwsx6gi5npnmpl5sapwmaqnjpueh7romn4h2pcosnwq7kmml2suloh7snaauhxtzukihhzyqhc7y2mpujjqgxkezs3mgo2eokpv52"),
  B("Gracie", "gracie", "2007-10-17T17:00:00.000Z", "wvbvcmq32jbefcbhnoxd5z57cbj4gvhgptpaetxsovyodolnr23usi5sqtkkxydmlfgvmtrytz3oec4qn4lyc347ywotdn5x5pqy4c7mwxkgi6lpvgy2i5fb57yaajg4"),
  B("Lily", "lily", "2007-10-18T17:00:00.000Z", "7wi3aky5yhptswilkun3kh4ltdcyqcst2wteagyenul7ip6xrmabwfgg3nctcxwvwxsqjyx5jbsjeumaqlxdhhckl7xd4msxiotro7viltcof7nfu3lmwhj6vox3ntzl"),
  B("Fera", "fera", "2012-10-19T17:00:00.000Z", "brxbhvddqsi25t7nqk5o3d3kwkp7jjwuypse5h4owwwpcbbbd5hksior5wrcx4w23tctaj2edkbvpl4n4ttslesthgikxy3gmkt5s6mv6fjftskvnyunhiwdlhw4helb"),
  B("Lulu", "lulu", "2002-10-22T17:00:00.000Z", "jdr2zwretdnm6ibjnctcj6i327ep5x7nswkpdehwsvfhuayarnt7sk46zc3upzhw5cpiayvji3ojlbf6jce24y5x4gdet6xyafks2uvca65y5shur6zwk5y73xuahr2u"),
  B("Lia", "lia", "2002-10-28T17:00:00.000Z", "ym5ljnjnnfjhswzdmnzw4nkjkbtx2yunxif4nexnisdvartt55l5wkexgtyzt6cq47ujzxj722tiae7itv7eb44klbxaazimc2fp2oufnc5jd4yu55gnnnkrka4cks3t"),
  B("Oline", "oline", "2007-11-02T17:00:00.000Z", "jhed4a4bqwnglawuufwanakszjhqykivbq2najnxv7gbhqk5muh7fn3ux6fbg3r4xk6iooxg6ponsnb4kp7vsbosactypgtbd2ci5sqvm2synhyeumqyfobyzcmfxtvg"),
  B("Jemima", "jemima", "2009-11-08T17:00:00.000Z", "6evzvcljy33awlgdkl5v33ktreizabsygurfjw23m5xhvid4ziryglalzho4igmo25j3yxk7gr2wprsddvs3fvtshcqjhvf3rvapxjv7nolg4i5spqbpg7udyrabvc2r"),
  B("Raisha", "raisha", "2007-11-10T17:00:00.000Z", "7lwtc5bc4a5ymqajsyylftgqkcx2o7j5tgktikrfvv5az4fk6t3zkxvuidzhu4qaccvkltbaiksvptlwximqv3vgeak53wy4pa376a2dpf4qz62bq2z5kvyuqlnngysm"),
  B("Cynthia", "cynthia", "2003-11-21T17:00:00.000Z", "sc5dvkibuw7imudsfteni6rpdtvzzp3exvob257nt7gc6gujrftcizezv7wcs5xxl5appwe3xgvdbdlcbw6mriv6eufj3friq6l7yxus4or26js3jd7ea6zhersb2sab"),
  B("Isha", "isha", "2007-11-24T17:00:00.000Z", "vwv4txq44s5pn7qlj7qjya3gxl5elk4wfnpzx7flhsrajh3ev4zh6quxunjxtkj6pitf6imk26yt3xannnvdibhwh2ernqekn2qcqhdizodwn4y62xezab4hkygv6xra", "png"),
  B("Sona", "sona", "2011-11-30T17:00:00.000Z", "gox3uptrlqfmnpqqqx3bed6p5fznspgftzwfywy7wk45eh7vnzhjp4mvz62oitq355wk3jlbccmhn5avt3sqem3ea6g3n46f47766gld6dofrphppza2sqfobsc2myyf"),
  B("Maxine", "maxine", "2011-12-01T17:00:00.000Z", "maie3bqrthh6ghurldf5cgxyyaa2xl6oivlpk7mtkaiwqe2y5yjo6hz6gyjrn7kmvzpssmgbyo73lp2x5ebafxozale4oxthkcembhyjhoz4nvrcelqgdd3kqv5oyfhu"),
  B("Christy", "christy", "2005-12-04T17:00:00.000Z", "oioaavkqcayswtcxpturk5bwxep6eshrnlnjzdyry36ebt4vquvwsihe4o6rqmmjmlbsceliyj4bzyur2gkd2ealovieiwg45h2yskrd7xrkqffsk2uxkzwlgblqv4bg"),
  B("Mikaela", "mikaela", "2007-12-14T17:00:00.000Z", "bija2ldl7sta6gd5akezaa77xrdtc4slo6t4qjlp6argelctw5clf2ajyn7cehe6d7dqxpej4pbtedcwye56ok3cwrwxkgiufz3eheqtmjuds23glyafw3egjsqb4u63"),
  B("Danella", "danella", "2005-12-15T17:00:00.000Z", "knts4s7ed4q3eesnsiayqexese3gglzwn6qqgzfmg2yqoiwqmt3tbpa6j6maymosbo7jbpxbfjncpdrxrpgcssy6bbxtiv7vuhbovifslvhcyhoxmexfxroxr43nl3ys"),
  B("Daisy", "daisy", "2005-12-15T17:00:00.000Z", "ku57aufbthc3uruxrjxpahdlqstje2gi27k47brhbxihhkwk6rfbjckheknddwk3k2nu4fqxmom6e74i7h4yr6i5fuebneluhpvnvpdluas4mxt7exo6knrmmib4mra2"),
  B("Chelsea", "chelsea", "2009-12-22T17:00:00.000Z", "rgxtbuu62cjfjulkdaru6fhm4mzpa7y3x6gdpz2jvfgek5kq6z2qcfbzvs6zp6suamjlnhuvulwo42psvkr3htzfv6p7a4mvfukmple4krpdycx4qpmdfgp7m7xchaia"),
  B("Lyn", "lyn", "2001-09-12T17:00:00.000Z", "npympmjnscnpsuyaezv4l4wqitjuolwywh357wwirieecft754jnynt6f4tnpiismyyin73ydxrwjuray7yvihezfuym2kdddwesll4hksv26egwv535k6vl2eyx4mjo"),
  B("Lana", "lana", "2006-09-13T17:00:00.000Z", "uofwtp7f6oc244lj7zxk23wvmm4rqpknee4yihxqzm5wp7pcokbtkbdzdfjnvhemqgyg6kwxmghq3bjsjef4jqwpctktvtmdbsjh7gl3kp3w6hx6qkm4lcgoaqdafjim"),
  B("Jessi", "jessi", "2005-09-22T17:00:00.000Z", "nlacafinaq3x7ffuxkoniohsrenntdncg7jyyxakes7pnvtmgn74ctd7fkblzr67hfrvnkxzxwjgxvuxtv2clkzipf5nnkl75kj7qwoxdxglqvbvje4u7jgsra4seopk"),
];
