#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const outputDir = path.join(root, "assets", "generated", "today");

async function loadEnv() {
  try {
    const content = await fs.readFile(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const sharedPrefix = `Create a premium Apple-inspired visual asset for a native iOS productivity app called Sipher.
Soft cinematic lighting, subtle depth, gentle gradients, glassy atmosphere, calm Apple Weather-like mood.
No text, no logos, no people, no hard outlines, no cartoon style, no photorealistic stock photo look.
Minimal, elegant, reusable, with plenty of negative space. Designed to sit behind native UI cards.`;

const assets = [
  {
    name: "weather_banner_clear_evening",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: clear evening weather banner for a wide rounded dashboard card.
This must work when cropped into a very wide horizontal card. Keep all important visual elements inside the central safe area. Place a small crescent moon in the upper-right quadrant but with generous safe margin from the top and right edges, never touching or near the edge. Use a blue-purple evening gradient sky, subtle stars, distant soft hills and lake shapes along the lower-right, and leave the entire left 45 percent mostly empty for native UI text. No text, no logo, no people, no buildings. The composition should feel like Apple Weather: calm, atmospheric, premium, and restrained.`
  },
  {
    name: "ambient_morning_haze",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: soft morning ambient background.
Pale blue, warm cream, and faint lavender gradient. Subtle sunrise glow near the upper-right edge. Very soft cinematic lighting, blurred atmospheric depth, smooth Apple Weather-like ambience. No hard objects, no icons, no text, no logo, no people, no landscape, no sharp shapes, no noisy texture.
Reusable as a subtle full-screen or card background behind native UI. Low contrast, calm, premium, minimal.`
  },
  {
    name: "ambient_evening_glow",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: calm evening ambient background.
Deep periwinkle, soft violet, muted blue, and a warm peach glow near one edge. Cinematic evening atmosphere, smooth blurred gradient mesh, subtle depth and light diffusion. No hard objects, no text, no logo, no people, no landscape, no stars unless extremely subtle.`
  },
  {
    name: "ambient_focus_purple",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: quiet focus mode ambient background.
Midnight purple, indigo, and faint blue glow. Soft blurred mesh gradient, tiny subtle floating particles, calm intelligent atmosphere, slight depth but not busy. No robots, no code, no text, no logo, no people, no hard geometric shapes, no neon cyberpunk look.`
  },
  {
    name: "overlay_clear_evening",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Transparent overlay: clear evening.
Tiny soft stars, faint moon glow, blue-violet haze, very subtle floating light particles, Apple Weather-like atmosphere. Mostly transparent, low contrast, soft edges only. No landscape, no clouds unless extremely faint, no hard moon disk, no text, no logo.`
  },
  {
    name: "overlay_soft_sun",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Transparent overlay: soft sunlight.
Warm circular glow, pale cream and soft yellow light, gentle lens haze. No visible hard sun disk, no landscape, no sky photo, no text, no logo. Mostly transparent, very soft edges, low contrast, preserves text readability.`
  },
  {
    name: "overlay_light_rain",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Transparent overlay: light rain.
Very soft diagonal rain streaks, blurred glass-like rain texture, cool blue-gray tint, subtle atmosphere. Calm and elegant, not stormy. Mostly transparent, low contrast, should not obscure UI text. No photo-real rain scene, no harsh contrast.`
  },
  {
    name: "overlay_cloud_blur",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Transparent overlay: soft cloud blur.
Soft white and lavender cloud forms, airy atmospheric blur, extremely low contrast, smooth edges, Apple Weather-like softness. Mostly transparent, spacious, subtle enough to sit behind native UI. No detailed sky photo, no hard outlines, no cartoon clouds.`
  },
  {
    name: "scene_weather_hills_evening",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: clear evening landscape for a dashboard weather card.
Blue-purple gradient evening sky, soft moonlight, tiny subtle stars, distant rounded hills, small minimal trees, calm lake or soft horizon shape, gentle depth and atmospheric blur. Leave the left side mostly empty for native UI text; visual detail mostly on the right and lower-right. No text, no logo, no people, no buildings.`
  },
  {
    name: "scene_priorities_mountain",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Scene: priorities / goal mountain.
Pastel lavender mountain peak with a tiny flag near the peak, soft clouds, pale blue and lavender lighting, gentle depth, calm aspirational focus. Transparent background, visual weight toward the lower-right, plenty of empty space for UI text. No text, no logo, no people, no detailed landscape.`
  },
  {
    name: "scene_family_home",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Scene: family / logistics.
Small cozy house on a soft green hill, one simple tree, one small cloud, warm gentle light, pastel colors, soft rounded shapes. Transparent background, house and hill toward the lower-right, left side open for UI text. No people, no text, no logo, no cars, no detailed neighborhood.`
  },
  {
    name: "scene_calendar_soft_blocks",
    size: "1536x1024",
    format: "png",
    background: "transparent",
    prompt: `${sharedPrefix}

Scene: abstract calendar and schedule planning.
Soft floating rounded blocks, faint timeline dots, subtle layered glass effect, lavender, pale blue, and soft white palette, gentle blur and depth. Transparent background, abstract and reusable, detail mostly right/lower-right, left side open for UI text. No readable text, no numbers, no dates, no hard grid.`
  },
  {
    name: "scene_focus_particles",
    size: "1536x1024",
    format: "webp",
    background: "opaque",
    prompt: `${sharedPrefix}

Scene: AI signals / focus particles.
Midnight-to-purple gradient, tiny floating particles, very faint orbital arcs, soft depth and glow, calm intelligent premium feeling, Apple-like but not sci-fi. Mostly abstract, low contrast, plenty of negative space. No robots, no faces, no code, no text, no logo, no neon cyberpunk.`
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { only: null, dryRun: false };
  args.forEach((arg) => {
    if (arg === "--dry-run") options.dryRun = true;
    if (arg.startsWith("--only=")) options.only = new Set(arg.slice("--only=".length).split(",").map((item) => item.trim()).filter(Boolean));
  });
  return options;
}

async function generate(asset) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error(`Missing OPENAI_API_KEY. Add it to ${envPath}`);

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium";
  const body = {
    model,
    prompt: asset.prompt,
    size: asset.size,
    quality,
    output_format: asset.format,
    background: asset.background,
    n: 1
  };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${asset.name} failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${asset.name} did not return b64_json`);

  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${asset.name}.${asset.format}`);
  await fs.writeFile(filePath, Buffer.from(b64, "base64"));
  return filePath;
}

async function main() {
  await loadEnv();
  const options = parseArgs();
  const selected = options.only ? assets.filter((asset) => options.only.has(asset.name)) : assets;
  if (!selected.length) throw new Error("No assets selected.");

  if (options.dryRun) {
    selected.forEach((asset) => {
      console.log(`${asset.name}.${asset.format}\n${asset.prompt}\n`);
    });
    return;
  }

  for (const asset of selected) {
    process.stdout.write(`Generating ${asset.name}.${asset.format}... `);
    const filePath = await generate(asset);
    console.log(filePath);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
