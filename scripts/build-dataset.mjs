// One-time (re-runnable) script that pulls real completed-auction listings from
// Bring a Trailer and turns them into src/data/cars.json.
//
// Usage: node scripts/build-dataset.mjs
//
// Two-stage approach:
//  1. Each https://bringatrailer.com/<make>/ hub page embeds a JS variable
//     `auctionsCompletedInitialData = {"items":[...]}` with lightweight listing
//     data (title, thumbnail image, listing URL). We use this to discover
//     candidate listings and get the exact year (parsed from the title).
//  2. Each individual listing page (e.g. /listing/1986-porsche-911-turbo-coupe-78/)
//     has BaT's own structured taxonomy fields in its "essentials" panel:
//     Make / Model / Era / Origin / Location. The Model field there is far more
//     accurate than anything parseable from the title alone (e.g. BaT's title
//     says "1986 Porsche 911 Turbo Coupe" but the structured Model field says
//     "Porsche 930 Turbo" - the correct chassis code). We fetch this per
//     candidate listing and use it as the answer key's make/model.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "cars.json");

const MAKERS = [
  ["porsche", "Porsche"],
  ["ferrari", "Ferrari"],
  ["lamborghini", "Lamborghini"],
  ["chevrolet", "Chevrolet"],
  ["ford", "Ford"],
  ["dodge", "Dodge"],
  ["jeep", "Jeep"],
  ["toyota", "Toyota"],
  ["nissan", "Nissan"],
  ["mazda", "Mazda"],
  ["honda", "Honda"],
  ["subaru", "Subaru"],
  ["volkswagen", "Volkswagen"],
  ["land-rover", "Land Rover"],
  ["jaguar", "Jaguar"],
  ["alfa-romeo", "Alfa Romeo"],
  ["audi", "Audi"],
  ["cadillac", "Cadillac"],
  ["pontiac", "Pontiac"],
  ["buick", "Buick"],
  ["bmw", "BMW"],
  ["mercedes-benz", "Mercedes-Benz"],
  ["mclaren", "McLaren"],
  ["maserati", "Maserati"],
  ["lotus", "Lotus"],
  ["datsun", "Datsun"],
  ["aston-martin", "Aston Martin"],
  ["fiat", "Fiat"],
  ["volvo", "Volvo"],
  ["saab", "Saab"],
  ["mitsubishi", "Mitsubishi"],
];

const MAX_PER_MAKE = 8;
const CANDIDATES_PER_MAKE = 16;
const TARGET_TOTAL = 180;
const REQUEST_DELAY_MS = 300;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const BLOCKLIST = [
  "sign",
  "clock",
  "poster",
  "memorabilia",
  "emblem",
  "badge",
  "die-cast",
  "diecast",
  "pedal car",
  "go-kart",
  "go kart",
  "golf cart",
  "snowmobile",
  "jet ski",
  " atv",
  " utv",
  "tractor",
  "wheel set",
  "wheels and tires",
  "toy car",
  "pinball",
  "neon sign",
  "motorcycle",
  " moto ",
  "scrambler",
  "gold wing",
  "goldwing",
  "africa twin",
  "monkey bike",
  "dirt bike",
  "dual-sport",
  "dual sport",
  "enduro",
  "supermoto",
  "cafe racer",
  "cafe-racer",
  "sportbike",
  "sport bike",
  "scooter",
  "step-through",
  "step through",
  "moped",
];

// BaT tags every listing with one or more "Category" essentials fields.
// Confirmed against BaT's own site nav (bringatrailer.com) - these are the
// non-car vehicle/goods categories to exclude; everything else (Convertibles,
// Station Wagons, Kei Vehicles, Race Cars, Electric Vehicles, etc.) is a real car.
const NON_CAR_CATEGORIES = new Set([
  "aircraft",
  "all-terrain vehicles",
  "boats",
  "go-karts",
  "motorcycles",
  "parts",
  "side-by-sides",
  "tractors",
  "trains",
  "wheels",
  "minibikes & scooters",
  "snowmobiles",
  "scooters",
  "mopeds",
  "automobilia",
  "memorabilia",
  "watercraft",
  "jet skis",
]);

// Internal chassis/generation codes BaT's structured Model field often
// carries (e.g. "E46 M3", "992 911 Turbo", "Bronco U13/U14/U15") - stripped
// to keep answers guessable. See stripVerboseCodes() for the guards that
// keep this from eating meaningful trim badges (V12, S/T) or makes whose
// numeric designation IS the model name (Ferrari 612, Fiat 500).
const TRAILING_CODE_WORDS = new Set([
  "NAS",
  "LWB",
  "SWB",
  "T1XL",
  "AM115",
  "M139",
  "M156",
  "L405",
  "L322",
]);
const LEADING_CODE_WORDS = new Set(["NB", "NC", "ND"]);
const NUMERIC_NAME_MAKES = new Set(["Ferrari", "Fiat"]);

function stripVerboseCodes(model, make) {
  let m = model.trim();
  const firstWord = m.split(" ")[0];
  // Engine notation (V6/V8/V10/V12, I4/I6) is meaningful spec, never a chassis code.
  const isEngineNotation = /^[VI]\d{1,2}$/i.test(firstWord);

  if (!isEngineNotation && LEADING_CODE_WORDS.has(firstWord)) {
    const rest = m.slice(firstWord.length).trim();
    if (rest.length >= 2) m = rest;
  }

  if (!isEngineNotation) {
    const leadingMatch = m.match(/^([A-Z]{0,2}\d{2,4}(?:\/[A-Z]?\d{2,4})*)\s+(.+)$/);
    if (leadingMatch && leadingMatch[2].trim().length >= 2) {
      // Ferrari/Fiat's numeric designations (612, 500...) ARE the model name,
      // unlike BMW/Porsche/Mercedes/Nissan generation-code prefixes.
      const isPureDigits = /^\d+$/.test(leadingMatch[1]);
      if (!(isPureDigits && NUMERIC_NAME_MAKES.has(make))) {
        m = leadingMatch[2].trim();
      }
    }
  }

  // Trailing slash-list of codes (e.g. U13/U14/U15) - require each segment to
  // contain a digit, so trim badges like "S/T" or "R/T" are never touched.
  const trailingSlash = m.match(/^(.*?)\s+([A-Za-z0-9]+(?:\/[A-Za-z0-9]+){1,})$/);
  if (trailingSlash) {
    const segments = trailingSlash[2].split("/");
    if (segments.every((s) => /\d/.test(s)) && trailingSlash[1].trim().length >= 2) {
      m = trailingSlash[1].trim();
    }
  }

  const words = m.split(" ");
  while (words.length > 1 && TRAILING_CODE_WORDS.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(" ");
}

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Extract the JSON object assigned to `varName` in raw HTML/JS by balanced-brace
// scanning (regex alone breaks on nested braces/semicolons inside string values).
function extractJsonVar(html, varName) {
  const marker = `var ${varName} = {`;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const braceStart = start + marker.length - 1; // index of the opening '{'
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = html.slice(braceStart, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch (err) {
          console.warn(`  failed to parse ${varName}: ${err.message}`);
          return null;
        }
      }
    }
  }
  return null;
}

function upsizeImage(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("w", "1600");
    u.searchParams.delete("h");
    u.searchParams.delete("crop");
    return u.toString();
  } catch {
    return url;
  }
}

// Stage 1: turn a raw hub-page item into a lightweight candidate (year + url),
// filtering out obvious junk by title alone (model is resolved in stage 2).
function toCandidate(item) {
  const title = decodeEntities(item.title || "");
  const lower = title.toLowerCase();
  if (BLOCKLIST.some((word) => lower.includes(word))) return null;

  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return null;

  if (!item.thumbnail_url || !item.url) return null;

  return {
    id: item.id,
    year: Number(yearMatch[1]),
    title,
    listingUrl: item.url,
    imageUrl: upsizeImage(item.thumbnail_url),
  };
}

async function fetchCandidates(slug) {
  const url = `https://bringatrailer.com/${slug}/`;
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA } });
  } catch (err) {
    console.warn(`  fetch failed for ${slug}: ${err.message}`);
    return [];
  }
  if (!res.ok) {
    console.warn(`  ${slug} -> HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const data = extractJsonVar(html, "auctionsCompletedInitialData");
  if (!data || !Array.isArray(data.items)) {
    console.warn(`  ${slug} -> no auctionsCompletedInitialData.items found`);
    return [];
  }

  const candidates = [];
  const seenUrl = new Set();
  for (const item of data.items) {
    const c = toCandidate(item);
    if (!c || seenUrl.has(c.listingUrl)) continue;
    seenUrl.add(c.listingUrl);
    candidates.push(c);
  }
  return shuffle(candidates).slice(0, CANDIDATES_PER_MAKE);
}

function cleanModel(rawModel, make) {
  let model = rawModel.trim();
  if (model.toLowerCase().startsWith(make.toLowerCase())) {
    model = model.slice(make.length).trim();
  }
  // Strip trailing year-range/generation suffixes, e.g. "Mustang 1964.5-1966" or "911 (996)".
  model = model.replace(/\s+\d{4}(?:\.\d)?(?:-\d{2,4}(?:\.\d)?)?$/, "").trim();
  model = model.replace(/\s*\((?:[^()]*\d{4}[^()]*)\)$/, "").trim();
  model = model.replace(/\s+\d+-Speed$/i, "").trim();
  model = model.replace(/\s{2,}/g, " ").trim();
  model = stripVerboseCodes(model, make);
  return model;
}

// Stage 2: fetch the listing page and pull BaT's own Make/Model fields out of
// the "essentials" panel: `<strong class="group-title-label">Model</strong>Porsche 930 Turbo`
async function fetchListingDetails(listingUrl, expectedMake) {
  let res;
  try {
    res = await fetch(listingUrl, { headers: { "User-Agent": UA } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const html = await res.text();

  const fields = {};
  const categories = [];
  const re = /group-title-label">([A-Za-z]+)<\/strong>([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const label = m[1];
    const value = decodeEntities(m[2]).trim();
    if (label === "Category") categories.push(value);
    else if (!(label in fields)) fields[label] = value;
  }

  if (categories.some((c) => NON_CAR_CATEGORIES.has(c.toLowerCase()))) return null;

  if (!fields.Make || !fields.Model) return null;
  if (fields.Make.toLowerCase() !== expectedMake.toLowerCase()) return null;

  const model = cleanModel(fields.Model, fields.Make);
  if (model.length < 2) return null;
  if (BLOCKLIST.some((word) => model.toLowerCase().includes(word))) return null;
  // "Omni & Plymouth Horizon", "Eclipse, Eagle Talon, & Plymouth Laser" etc. are BaT's
  // joint naming for shared platforms across brands - not a single guessable answer.
  if (model.includes("&")) return null;

  return { make: fields.Make, model };
}

async function buildForMake(slug, make) {
  const candidates = await fetchCandidates(slug);
  const results = [];
  for (const c of candidates) {
    if (results.length >= MAX_PER_MAKE) break;
    await sleep(REQUEST_DELAY_MS);
    const details = await fetchListingDetails(c.listingUrl, make);
    if (!details) continue;
    results.push({
      id: c.id,
      year: c.year,
      make: details.make,
      model: details.model,
      imageUrl: c.imageUrl,
      listingUrl: c.listingUrl,
    });
  }
  return results;
}

async function main() {
  const all = [];
  for (const [slug, make] of MAKERS) {
    process.stdout.write(`Fetching ${make} (${slug})... `);
    const cars = await buildForMake(slug, make);
    console.log(`${cars.length} usable`);
    all.push(...cars);
    await sleep(REQUEST_DELAY_MS);
  }

  // Dedup by year+model (a make page can occasionally surface the same car twice).
  const deduped = [];
  const seen = new Set();
  for (const car of all) {
    const key = `${car.make}-${car.year}-${car.model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(car);
  }

  const trimmed = shuffle(deduped).slice(0, TARGET_TOTAL);
  trimmed.sort((a, b) => a.make.localeCompare(b.make) || a.year - b.year);

  await writeFile(OUT_PATH, JSON.stringify(trimmed, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${trimmed.length} cars to ${OUT_PATH}`);
}

main();
