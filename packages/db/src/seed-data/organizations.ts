import type { Database } from "../index";
import { schema } from "../index";
import { ORG_ID } from "./ids";

export async function seedOrganizations(db: Database) {
  await db.insert(schema.organizations).values({
    id: ORG_ID,
    name: "Hotel Mariana",
    slug: "hotel-mariana",
    settings: {
      timezone: "America/New_York",
      defaultLanguage: "en",
      supportedLanguages: ["en", "es", "zh", "fr", "ja", "ko", "ar", "pt"],
      retentionDays: 90,
      theme: { primaryColor: "#d4a574", logo: "/assets/hotel-mariana-logo.svg" },
    } as any,
  });
}
