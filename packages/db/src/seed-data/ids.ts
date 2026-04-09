// Deterministic UUIDs for all seed entities
// Centralized here to avoid circular imports between seed modules

export const ORG_ID = "00000000-0000-0000-0000-000000000001";

export const DEPT_IDS = {
  maintenance: "00000000-0000-0000-0001-000000000001",
  housekeeping: "00000000-0000-0000-0001-000000000002",
  concierge: "00000000-0000-0000-0001-000000000003",
  frontDesk: "00000000-0000-0000-0001-000000000004",
  kitchen: "00000000-0000-0000-0001-000000000005",
} as const;

export const USER_IDS: Record<number, string> = {
  1: "00000000-0000-0000-0002-000000000001",
  2: "00000000-0000-0000-0002-000000000002",
  3: "00000000-0000-0000-0002-000000000003",
  4: "00000000-0000-0000-0002-000000000004",
  5: "00000000-0000-0000-0002-000000000005",
  6: "00000000-0000-0000-0002-000000000006",
  7: "00000000-0000-0000-0002-000000000007",
  8: "00000000-0000-0000-0002-000000000008",
  9: "00000000-0000-0000-0002-000000000009",
  10: "00000000-0000-0000-0002-000000000010",
  11: "00000000-0000-0000-0002-000000000011",
  12: "00000000-0000-0000-0002-000000000012",
};

// ROOM_IDS indexed by room number string
export const ROOM_IDS: Record<string, string> = {};

const floors: { floor: number; rooms: string[]; zone: string }[] = [
  { floor: 1, rooms: ["101", "102", "103", "104", "105"], zone: "Lobby Wing" },
  { floor: 2, rooms: ["201", "202", "203", "204", "205"], zone: "Garden Wing" },
  { floor: 3, rooms: ["301", "302", "303", "304", "305"], zone: "Ocean Wing" },
  { floor: 4, rooms: ["401", "402", "403", "404", "405", "410", "411", "412"], zone: "Penthouse Wing" },
  { floor: 5, rooms: ["501", "502", "503", "504", "505"], zone: "Skyline Wing" },
  { floor: 6, rooms: ["601", "602", "603", "604", "605"], zone: "Presidential Wing" },
];

let roomIndex = 1;
for (const f of floors) {
  for (const roomNum of f.rooms) {
    const padded = String(roomIndex).padStart(2, "0");
    ROOM_IDS[roomNum] = `00000000-0000-0000-0003-0000000000${padded}`;
    roomIndex++;
  }
}

export { floors as FLOOR_DATA };

export function requestId(n: number): string {
  const padded = String(n).padStart(2, "0");
  return `00000000-0000-0000-0004-0000000000${padded}`;
}

export function workflowId(n: number): string {
  const padded = String(n).padStart(2, "0");
  return `00000000-0000-0000-0005-0000000000${padded}`;
}

export const INTEGRATION_IDS = {
  opera: "00000000-0000-0000-0007-000000000001",
  slack: "00000000-0000-0000-0007-000000000002",
  jira: "00000000-0000-0000-0007-000000000003",
};
