export function buildClassifyPrompt(
  text: string,
  departments: string[],
): string {
  return `You are a hotel request classifier. Analyze the guest request and respond with ONLY valid JSON.

Available departments: ${departments.join(", ")}

Guest request: "${text}"

Respond with this exact JSON structure:
{
  "translated": "<English translation if not already English, otherwise same text>",
  "department": "<one of the available departments>",
  "urgency": "<low|medium|high|critical>",
  "summary": "<brief English summary, max 100 chars>"
}

Rules:
- "critical" = safety hazard, flood, fire, medical
- "high" = broken essential (AC, plumbing, lock)
- "medium" = comfort/convenience (towels, amenities)
- "low" = information request, nice-to-have`;
}
