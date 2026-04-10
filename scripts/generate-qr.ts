// Usage: bun scripts/generate-qr.ts
// Generates QR codes for all rooms in Hotel Mariana
// Outputs SVG files to scripts/qr-output/ organized by floor

import QRCode from "qrcode";
import { db, schema } from "@hospiq/db";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ORG_SLUG = "hotel-mariana";
const ORG_NAME = "Hotel Mariana";
const BASE_URL = process.env.HOSPIQ_BASE_URL || "https://hospiq.local";
const OUTPUT_DIR = join(import.meta.dir, "qr-output");

async function main() {
  console.log("Fetching rooms from database...");

  const rooms = await db.query.rooms.findMany({
    where: eq(schema.rooms.orgId, ORG_ID),
    orderBy: (r, { asc }) => [asc(r.number)],
  });

  if (rooms.length === 0) {
    console.log("No rooms found. Run db:seed first.");
    process.exit(1);
  }

  console.log(`Found ${rooms.length} rooms. Generating QR codes...`);

  // Group rooms by floor
  const byFloor = new Map<number, typeof rooms>();
  for (const room of rooms) {
    const floor = room.floor ?? 0;
    if (!byFloor.has(floor)) byFloor.set(floor, []);
    byFloor.get(floor)!.push(room);
  }

  let count = 0;

  for (const [floor, floorRooms] of byFloor) {
    const floorDir = join(OUTPUT_DIR, `floor-${floor}`);
    await mkdir(floorDir, { recursive: true });

    for (const room of floorRooms) {
      const url = `${BASE_URL}/${ORG_SLUG}/room/${room.number}`;

      // Generate SVG with hotel-appropriate colors
      const svg = await QRCode.toString(url, {
        type: "svg",
        width: 200,
        margin: 2,
        color: {
          dark: "#1a1a2e",
          light: "#f5f0eb",
        },
        errorCorrectionLevel: "M",
      });

      // Wrap SVG in a printable card layout
      const card = buildSVGCard(svg, room.number, ORG_NAME);

      const filePath = join(floorDir, `room-${room.number}.svg`);
      await writeFile(filePath, card, "utf-8");
      count++;
    }

    console.log(`  Floor ${floor}: ${floorRooms.length} QR codes`);
  }

  console.log(`\nDone! Generated ${count} QR code cards in ${OUTPUT_DIR}`);
  process.exit(0);
}

function buildSVGCard(
  qrSvg: string,
  roomNumber: string,
  orgName: string,
): string {
  // Extract the inner content of the QR SVG (strip the outer <svg> wrapper)
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const qrInner = innerMatch ? innerMatch[1] : qrSvg;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="440" viewBox="0 0 320 440">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&amp;family=DM+Sans:wght@400;500&amp;display=swap');
    </style>
  </defs>

  <!-- Card background -->
  <rect width="320" height="440" rx="16" fill="#ffffff" stroke="#e0dcd7" stroke-width="1"/>

  <!-- QR code background -->
  <rect x="52" y="32" width="216" height="216" rx="12" fill="#f5f0eb"/>

  <!-- QR code -->
  <g transform="translate(60, 40)">
    ${qrInner}
  </g>

  <!-- Gold accent line -->
  <rect x="60" y="272" width="200" height="2" fill="#d4a574"/>

  <!-- Room number -->
  <text x="160" y="312" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-weight="bold" font-size="28" fill="#1a1a2e">
    Room ${roomNumber}
  </text>

  <!-- Org name -->
  <text x="160" y="344" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-size="18" fill="#6b6b80">
    ${orgName}
  </text>

  <!-- Instruction -->
  <text x="160" y="388" text-anchor="middle" font-family="'DM Sans', 'Helvetica Neue', sans-serif" font-size="13" fill="#a0a0b0">
    Scan to request assistance
  </text>
</svg>`;
}

main().catch((err) => {
  console.error("Error generating QR codes:", err);
  process.exit(1);
});
