import { FastMCP } from "fastmcp";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "data", "manifest.json"), "utf8"));
const shardCache = new Map();

async function shardData(i) {
  const idx = Math.floor(i / manifest.cap);
  if (!shardCache.has(idx)) {
    const f = `shard-${String(idx).padStart(4, "0")}.json`;
    shardCache.set(idx, JSON.parse(readFileSync(join(root, "data", "shards", f), "utf8")));
  }
  return shardCache.get(idx)[i % manifest.cap];
}

const svgOf = (id, d, c = "#D0BCFF") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="${d}" fill="${c}"/></svg>`;

const xmlOf = (d, c = "#D0BCFF") =>
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="200dp" android:height="200dp"\n    android:viewportWidth="200" android:viewportHeight="200">\n    <path android:fillColor="${c}" android:pathData="${d}"/>\n</vector>`;

const composeOf = (id, d, c = "#D0BCFF") =>
  `val shape = PathParser().parsePathString("${d}").toPath()\n// draw: Canvas { drawPath(shape, Color(0xFF${c.slice(1)})) }  // ${id}, 200x200 viewport`;

const server = new FastMCP({ name: "android-shapes", version: "0.1.0" });

server.addTool({
  name: "search_shapes",
  description: "Search the android-shapes library. Query tokens match shape id and tags (family, family+vX/pX/kX/tX/jX/eX buckets, round/mid/soft, slim/mid/fat, etc).",
  parameters: z.object({
    query: z.string().describe("e.g. 'star slim', 'gear t12', 'blob f23', 'drop-0042'"),
    limit: z.number().default(20).describe("max results"),
  }),
  execute: async ({ query, limit }) => {
    const q = query.trim().toLowerCase().split(/\s+/);
    const out = [];
    for (const e of manifest.entries) {
      const hay = e.id + " " + e.t;
      if (q.every((tok) => hay.includes(tok))) {
        out.push({ ...e, tags: e.t.split("|") });
        if (out.length >= limit) break;
      }
    }
    return JSON.stringify({ count: out.length, shapes: out }, null, 2);
  },
});

server.addTool({
  name: "get_shape",
  description: "Get one shape from android-shapes: raw path data plus ready-to-paste SVG, Android VectorDrawable XML, and Jetpack Compose snippet.",
  parameters: z.object({
    id: z.string().describe("shape id like 'star-0421' (from search_shapes)"),
    color: z.string().default("#D0BCFF").describe("hex color to bake into exports"),
  }),
  execute: async ({ id, color }) => {
    const i = manifest.entries.findIndex((e) => e.id === id);
    if (i < 0) return `shape not found: ${id}`;
    const s = await shardData(manifest.entries[i].i);
    return JSON.stringify(
      {
        id: s.id,
        pathData: s.d,
        svg: svgOf(s.id, s.d, color),
        androidXml: xmlOf(s.d, color),
        compose: composeOf(s.id, s.d, color),
      },
      null,
      2
    );
  },
});

server.start({ transportType: "stdio" });
