import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID, DEPT_IDS, USER_IDS } from "./ids";

export async function seedDepartments(db: Database) {
  await db.insert(schema.departments).values([
    {
      id: DEPT_IDS.maintenance,
      orgId: ORG_ID,
      name: "Maintenance",
      slug: "maintenance",
      slaConfig: { low: 120, medium: 60, high: 30, critical: 15 },
      escalationTo: USER_IDS[10],
      active: true,
    },
    {
      id: DEPT_IDS.housekeeping,
      orgId: ORG_ID,
      name: "Housekeeping",
      slug: "housekeeping",
      slaConfig: { low: 90, medium: 45, high: 20, critical: 10 },
      escalationTo: USER_IDS[10],
      active: true,
    },
    {
      id: DEPT_IDS.concierge,
      orgId: ORG_ID,
      name: "Concierge",
      slug: "concierge",
      slaConfig: { low: 60, medium: 30, high: 15, critical: 10 },
      escalationTo: USER_IDS[10],
      active: true,
    },
    {
      id: DEPT_IDS.frontDesk,
      orgId: ORG_ID,
      name: "Front Desk",
      slug: "front-desk",
      slaConfig: { low: 30, medium: 15, high: 10, critical: 5 },
      escalationTo: USER_IDS[10],
      active: true,
    },
    {
      id: DEPT_IDS.kitchen,
      orgId: ORG_ID,
      name: "Kitchen / Room Service",
      slug: "kitchen",
      slaConfig: { low: 45, medium: 25, high: 15, critical: 10 },
      escalationTo: USER_IDS[11],
      active: true,
    },
  ]);
}
