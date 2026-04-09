#!/usr/bin/env bun
/**
 * HospiQ Request Simulator
 *
 * Usage: bun scripts/simulate.ts
 *
 * Fires 1 guest request every 5 seconds with random language/category.
 * Uses the API endpoint directly. Press Ctrl+C to stop.
 */

const API_BASE = process.env.API_URL || "http://localhost:3001";
const ORG_ID = "00000000-0000-0000-0000-000000000001";

const templates = [
  { text: "My faucet is leaking", room: "412", lang: "en" },
  { text: "Necesitamos mas toallas", room: "203", lang: "es" },
  { text: "エアコンが動かない", room: "601", lang: "ja" },
  { text: "Le wifi ne marche pas", room: "302", lang: "fr" },
  { text: "Can someone bring extra pillows?", room: "105", lang: "en" },
  { text: "电视遥控器坏了", room: "501", lang: "zh" },
  { text: "There's a cockroach in my room!", room: "404", lang: "en" },
  { text: "Could you recommend a nearby pharmacy?", room: "201", lang: "en" },
  { text: "Brauchen mehr Kaffee-Pads", room: "315", lang: "de" },
  { text: "Il riscaldamento non funziona", room: "208", lang: "it" },
  { text: "The shower drain is clogged", room: "517", lang: "en" },
  { text: "Preciso de um berco para bebe", room: "110", lang: "pt" },
  { text: "Room safe won't lock", room: "603", lang: "en" },
  { text: "Klimaanlage tropft", room: "422", lang: "de" },
  { text: "Can I get a late checkout?", room: "309", lang: "en" },
  { text: "Les lumieres clignotent", room: "205", lang: "fr" },
  { text: "Mini bar needs restocking", room: "710", lang: "en" },
  { text: "La puerta no cierra bien", room: "118", lang: "es" },
  { text: "Hot water is not working", room: "333", lang: "en" },
  { text: "Besoin d'un fer a repasser", room: "407", lang: "fr" },
];

let count = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fireRequest() {
  const t = pick(templates);
  try {
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: t.text,
        room_number: t.room,
        org_id: ORG_ID,
        lang: t.lang,
      }),
    });

    count++;
    if (res.ok) {
      const data = (await res.json()) as { request_id: string };
      console.log(
        `[${count}] ✓ Room ${t.room} (${t.lang}): "${t.text}" → ${data.request_id.slice(0, 8)}`
      );
    } else {
      console.log(
        `[${count}] ✗ Room ${t.room} (${t.lang}): "${t.text}" → HTTP ${res.status}`
      );
    }
  } catch (err) {
    count++;
    console.log(
      `[${count}] ✗ Room ${t.room} (${t.lang}): "${t.text}" → ${(err as Error).message}`
    );
  }
}

console.log(`\n🏨 HospiQ Simulator`);
console.log(`   API: ${API_BASE}`);
console.log(`   Interval: 5s`);
console.log(`   Templates: ${templates.length}`);
console.log(`   Press Ctrl+C to stop\n`);

// Fire one immediately, then every 5s
fireRequest();
setInterval(fireRequest, 5000);
