import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "./prng.mjs";
import { makePoly, makeStar, makeBurst, makeBlob, makeFlower, makeGear, makeSquircle, makeDrop } from "./families.mjs";

const COUNT = Number(process.argv[2]) || 50_000;
const PER_FAMILY = Math.floor(COUNT / 8);
const FAMILIES = ["poly", "star", "burst", "blob", "flower", "gear", "squircle", "drop"];
const SHARD_CAP = 250;
const makers = { poly: makePoly, star: makeStar, burst: makeBurst, blob: makeBlob, flower: makeFlower, gear: makeGear, squircle: makeSquircle, drop: makeDrop };

const hashFam = (fam) => {
  let h = 0;
  for (const ch of fam) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) >>> 0;
};

const manifest = [];
const shards = [];
let shard = [];
let gi = 0;

for (const fam of FAMILIES) {
  const seen = new Set();
  for (let i = 0; i < PER_FAMILY; i++) {
    const rnd = mulberry32(hashFam(fam) + i);
    let out = makers[fam](i, rnd);
    let guard = 0;
    while (seen.has(out.d) && guard < 24) {
      out = makers[fam](i + ++guard * 271, mulberry32(hashFam(fam) + i * 31 + guard));
    }
    seen.add(out.d);
    const entry = { i: gi++, id: `${fam}-${String(i + 1).padStart(4, "0")}`, f: fam, t: [fam, ...out.tags].join("|") };
    manifest.push(entry);
    shard.push({ i: entry.i, id: entry.id, d: out.d });
    if (shard.length === SHARD_CAP) {
      shards.push(shard);
      shard = [];
    }
  }
}
if (shard.length) shards.push(shard);

mkdirSync(join("data", "shards"), { recursive: true });
writeFileSync(
  join("data", "manifest.json"),
  JSON.stringify({ count: manifest.length, cap: SHARD_CAP, families: FAMILIES, entries: manifest })
);
shards.forEach((s, idx) =>
  writeFileSync(join("data", "shards", `shard-${String(idx).padStart(4, "0")}.json`), JSON.stringify(s))
);

let bytes = 0;
for (const s of shards) bytes += JSON.stringify(s).length;
console.log(`count=${COUNT} shapes=${manifest.length} shards=${shards.length} pathBytes=${bytes}`);
