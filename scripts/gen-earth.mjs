// Builds content/earth-dots.json: evenly spaced points on land, from Natural Earth (world-atlas).
// Run: node scripts/gen-earth.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";

const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/land-110m.json", import.meta.url)));
const land = feature(topo, topo.objects.land);

const N = 26000; // fibonacci sphere samples
const golden = Math.PI * (3 - Math.sqrt(5));
const out = [];
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = ((((i * golden) % (2 * Math.PI)) * 180) / Math.PI) - 180;
  if (geoContains(land, [lon, lat])) out.push(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
}
writeFileSync(new URL("../content/earth-dots.json", import.meta.url), JSON.stringify(out));
console.log("land dots:", out.length / 2);
