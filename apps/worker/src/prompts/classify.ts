export function buildClassifyPrompt(
  text: string,
  departments: string[],
): string {
  return `You are a hotel request classifier. Analyze the guest request and respond with ONLY valid JSON.

Available departments (you MUST pick one of these exactly):
${departments.map((d, i) => `${i + 1}. "${d}"`).join("\n")}

Examples:
- "bottle of water", "room service menu", "food order" → "Kitchen / Room Service"
- "extra towels", "clean room", "dirty sheets" → "Housekeeping"
- "leaking faucet", "broken AC", "no hot water" → "Maintenance"
- "restaurant recommendation", "taxi", "tour booking" → "Concierge"
- "check-out time", "wifi password", "lost key" → "Front Desk"

Guest request: "${text}"

Respond with this exact JSON structure (no extra text):
{
  "translated": "<English translation if not already English, otherwise the same text>",
  "department": "<EXACTLY one of the department names listed above>",
  "urgency": "<low|medium|high|critical>",
  "summary": "<brief English summary, max 100 chars>"
}

Urgency rules:
- "critical" = safety hazard, flood, fire, medical emergency
- "high" = broken essential (AC, plumbing, lock, no water)
- "medium" = comfort/convenience (towels, amenities, food)
- "low" = information request, nice-to-have`;
}
