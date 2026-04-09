import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, DEPT_IDS, ROOM_IDS, USER_IDS, requestId } from "./ids";

export const REQUEST_IDS = {
  demo: Array.from({ length: 8 }, (_, i) => requestId(i + 1)),
  historical: Array.from({ length: 50 }, (_, i) => requestId(i + 9)),
};

// Helper: get a date N hours ago
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysAgo(d: number, hourOffset = 0): Date {
  return new Date(Date.now() - (d * 24 + hourOffset) * 60 * 60 * 1000);
}

// Seeded pseudo-random for determinism
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const demoRequests = [
  {
    id: requestId(1),
    roomId: ROOM_IDS["412"],
    guestId: USER_IDS[1],
    originalLang: "zh",
    originalText: "水龙头漏水很严重",
    translated: "The faucet is leaking badly",
    status: "completed" as const,
    createdAt: hoursAgo(3),
  },
  {
    id: requestId(2),
    roomId: ROOM_IDS["305"],
    guestId: USER_IDS[1],
    originalLang: "en",
    originalText: "The drain in my bathroom is completely clogged",
    translated: null,
    status: "classified" as const,
    createdAt: hoursAgo(2),
  },
  {
    id: requestId(3),
    roomId: ROOM_IDS["203"],
    guestId: USER_IDS[2],
    originalLang: "es",
    originalText: "Necesitamos más toallas por favor",
    translated: "We need more towels please",
    status: "classified" as const,
    createdAt: hoursAgo(1.5),
  },
  {
    id: requestId(4),
    roomId: ROOM_IDS["103"],
    guestId: USER_IDS[1],
    originalLang: "en",
    originalText: "Can someone help me connect to the WiFi?",
    translated: null,
    status: "classified" as const,
    createdAt: hoursAgo(1),
  },
  {
    id: requestId(5),
    roomId: ROOM_IDS["601"],
    guestId: USER_IDS[2],
    originalLang: "ja",
    originalText: "エアコンが壊れています。とても暑いです",
    translated: "The air conditioner is broken. It is very hot",
    status: "classified" as const,
    createdAt: hoursAgo(0.5),
  },
  {
    id: requestId(6),
    roomId: ROOM_IDS["302"],
    guestId: USER_IDS[1],
    originalLang: "fr",
    originalText: "Pouvez-vous recommander un bon restaurant?",
    translated: "Can you recommend a good restaurant?",
    status: "completed" as const,
    createdAt: hoursAgo(5),
  },
  {
    id: requestId(7),
    roomId: ROOM_IDS["201"],
    guestId: USER_IDS[2],
    originalLang: "en",
    originalText: "There's a large spill in the lobby near the elevator",
    translated: null,
    status: "classified" as const,
    createdAt: hoursAgo(0.75),
  },
  {
    id: requestId(8),
    roomId: ROOM_IDS["403"],
    guestId: USER_IDS[1],
    originalLang: "ko",
    originalText: "룸서비스 메뉴를 받을 수 있나요?",
    translated: "Can I get a room service menu?",
    status: "processing" as const,
    createdAt: hoursAgo(0.25),
  },
];

// Historical request templates by department
const historicalTexts: Record<string, { en: string[]; es: string[]; zh: string[]; fr: string[]; ja: string[]; ko: string[] }> = {
  maintenance: {
    en: ["The shower head is broken", "Light bulb burned out in the bathroom", "TV remote not working", "Window won't close properly", "Toilet keeps running"],
    es: ["El grifo gotea", "La puerta no cierra bien", "El aire acondicionado hace ruido"],
    zh: ["灯泡坏了", "马桶堵了", "窗户打不开"],
    fr: ["La climatisation ne fonctionne pas", "Le robinet fuit"],
    ja: ["テレビがつきません", "シャワーの水圧が弱いです"],
    ko: ["화장실 변기가 막혔어요"],
  },
  housekeeping: {
    en: ["Need extra pillows please", "Room hasn't been cleaned today", "Minibar needs restocking", "Need fresh towels"],
    es: ["Necesitamos más almohadas", "La habitación necesita limpieza"],
    zh: ["请多给些毛巾", "房间需要打扫"],
    fr: ["Besoin de serviettes propres", "Le minibar est vide"],
    ja: ["タオルを追加してください"],
    ko: ["침구를 교체해 주세요"],
  },
  concierge: {
    en: ["Can you book a dinner reservation?", "Need a taxi to the airport", "What are the best local attractions?", "Can you arrange a city tour?"],
    es: ["Puede recomendar un buen restaurante?", "Necesito un taxi"],
    zh: ["请帮我预订餐厅", "附近有什么好玩的"],
    fr: ["Pouvez-vous réserver un restaurant?"],
    ja: ["おすすめの観光スポットはありますか"],
    ko: ["공항까지 택시를 불러주세요"],
  },
  frontDesk: {
    en: ["I need a late checkout", "Can I get a wake-up call at 6 AM?", "My key card stopped working"],
    es: ["Necesito hacer checkout tarde", "Mi tarjeta no funciona"],
    zh: ["房卡不能用了", "可以延迟退房吗"],
    fr: ["Je voudrais un réveil à 7h"],
    ja: ["チェックアウトを延長したいです"],
    ko: ["키카드가 안 돼요"],
  },
  kitchen: {
    en: ["I'd like to order room service", "Can I get breakfast delivered to my room?"],
    es: ["Quiero pedir servicio a la habitación"],
    zh: ["我想点客房送餐"],
    fr: ["Je voudrais commander le petit-déjeuner"],
    ja: ["ルームサービスを注文したいです"],
    ko: ["룸서비스 주문하고 싶어요"],
  },
};

const translations: Record<string, string> = {
  "El grifo gotea": "The faucet drips",
  "La puerta no cierra bien": "The door doesn't close properly",
  "El aire acondicionado hace ruido": "The air conditioning is noisy",
  "灯泡坏了": "The light bulb is broken",
  "马桶堵了": "The toilet is clogged",
  "窗户打不开": "The window won't open",
  "La climatisation ne fonctionne pas": "The air conditioning doesn't work",
  "Le robinet fuit": "The faucet leaks",
  "テレビがつきません": "The TV won't turn on",
  "シャワーの水圧が弱いです": "The shower water pressure is weak",
  "화장실 변기가 막혔어요": "The bathroom toilet is clogged",
  "Necesitamos más almohadas": "We need more pillows",
  "La habitación necesita limpieza": "The room needs cleaning",
  "请多给些毛巾": "Please give more towels",
  "房间需要打扫": "The room needs cleaning",
  "Besoin de serviettes propres": "Need clean towels",
  "Le minibar est vide": "The minibar is empty",
  "タオルを追加してください": "Please add towels",
  "침구를 교체해 주세요": "Please change the bedding",
  "Puede recomendar un buen restaurante?": "Can you recommend a good restaurant?",
  "Necesito un taxi": "I need a taxi",
  "请帮我预订餐厅": "Please book a restaurant for me",
  "附近有什么好玩的": "What's fun to do nearby?",
  "Pouvez-vous réserver un restaurant?": "Can you reserve a restaurant?",
  "おすすめの観光スポットはありますか": "Are there recommended tourist spots?",
  "공항까지 택시를 불러주세요": "Please call a taxi to the airport",
  "Necesito hacer checkout tarde": "I need a late checkout",
  "Mi tarjeta no funciona": "My card doesn't work",
  "房卡不能用了": "The room card doesn't work",
  "可以延迟退房吗": "Can I have a late checkout?",
  "Je voudrais un réveil à 7h": "I'd like a wake-up call at 7 AM",
  "チェックアウトを延長したいです": "I'd like to extend checkout",
  "키카드가 안 돼요": "The key card doesn't work",
  "Quiero pedir servicio a la habitación": "I want to order room service",
  "我想点客房送餐": "I want to order room delivery",
  "Je voudrais commander le petit-déjeuner": "I'd like to order breakfast",
  "ルームサービスを注文したいです": "I'd like to order room service",
  "룸서비스 주문하고 싶어요": "I'd like to order room service",
};

const roomNumbers = Object.keys(ROOM_IDS);

// Department keys in distribution order
const deptDistribution = [
  ...Array(15).fill("maintenance"),
  ...Array(13).fill("housekeeping"),
  ...Array(10).fill("concierge"),
  ...Array(7).fill("frontDesk"),
  ...Array(5).fill("kitchen"),
];

const langDistribution = [
  ...Array(20).fill("en"),
  ...Array(10).fill("es"),
  ...Array(8).fill("zh"),
  ...Array(5).fill("fr"),
  ...Array(5).fill("ja"),
  ...Array(2).fill("ko"),
];

const priorityDistribution = [
  ...Array(18).fill("low"),
  ...Array(17).fill("medium"),
  ...Array(10).fill("high"),
  ...Array(5).fill("critical"),
];

export interface HistoricalRequestMeta {
  id: string;
  deptKey: string;
  priority: string;
  resolutionMinutes: number;
  createdAt: Date;
}

export const historicalMeta: HistoricalRequestMeta[] = [];

export async function seedRequests(db: Database) {
  // Insert demo requests
  await db.insert(schema.requests).values(
    demoRequests.map((r) => ({
      ...r,
      orgId: ORG_ID,
      audioUrl: null,
    })),
  );

  // Generate 50 historical requests
  const rand = seededRandom(42);
  const historicalValues = [];

  for (let i = 0; i < 50; i++) {
    const idx = i;
    const deptKey = deptDistribution[idx % deptDistribution.length];
    const lang = langDistribution[idx % langDistribution.length] as keyof typeof historicalTexts.maintenance;
    const priority = priorityDistribution[idx % priorityDistribution.length];

    const deptTexts = historicalTexts[deptKey][lang] || historicalTexts[deptKey].en;
    const textIdx = Math.floor(rand() * deptTexts.length);
    const originalText = deptTexts[textIdx];
    const translated = lang === "en" ? null : (translations[originalText] || originalText);

    const dayOffset = Math.floor(rand() * 7);
    const hourOffset = Math.floor(rand() * 24);
    const createdAt = daysAgo(dayOffset, hourOffset);
    const resolutionMinutes = 5 + Math.floor(rand() * 55);

    const roomIdx = Math.floor(rand() * roomNumbers.length);
    const roomNum = roomNumbers[roomIdx];

    const reqId = requestId(i + 9);

    historicalMeta.push({
      id: reqId,
      deptKey,
      priority,
      resolutionMinutes,
      createdAt,
    });

    historicalValues.push({
      id: reqId,
      orgId: ORG_ID,
      guestId: rand() > 0.5 ? USER_IDS[1] : USER_IDS[2],
      roomId: ROOM_IDS[roomNum],
      originalLang: lang,
      originalText,
      translated,
      audioUrl: null,
      status: "completed" as const,
      createdAt,
    });
  }

  await db.insert(schema.requests).values(historicalValues);
}

// Re-export demo request metadata for workflows/events
export const demoRequestMeta = [
  { id: requestId(1), deptKey: "maintenance", priority: "high" as const, status: "resolved" as const },
  { id: requestId(2), deptKey: "maintenance", priority: "high" as const, status: "escalated" as const },
  { id: requestId(3), deptKey: "housekeeping", priority: "medium" as const, status: "claimed" as const },
  { id: requestId(4), deptKey: "frontDesk", priority: "low" as const, status: "in_progress" as const },
  { id: requestId(5), deptKey: "maintenance", priority: "critical" as const, status: "pending" as const },
  { id: requestId(6), deptKey: "concierge", priority: "low" as const, status: "resolved" as const },
  { id: requestId(7), deptKey: "housekeeping", priority: "high" as const, status: "claimed" as const },
  { id: requestId(8), deptKey: "kitchen", priority: "low" as const, status: "pending" as const },
];
