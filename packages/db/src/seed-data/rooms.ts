import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, ROOM_IDS, FLOOR_DATA } from "./ids";

export async function seedRooms(db: Database) {
  const values = [];
  for (const f of FLOOR_DATA) {
    for (const roomNum of f.rooms) {
      values.push({
        id: ROOM_IDS[roomNum],
        orgId: ORG_ID,
        number: roomNum,
        floor: f.floor,
        zone: f.zone,
      });
    }
  }
  await db.insert(schema.rooms).values(values);
}
