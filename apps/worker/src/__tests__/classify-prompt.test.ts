import { describe, test, expect } from "bun:test";
import { buildClassifyPrompt } from "../prompts/classify";

describe("Classification Prompt", () => {
  test("includes all department names", () => {
    const prompt = buildClassifyPrompt("test request", [
      "Maintenance",
      "Kitchen",
      "Housekeeping",
    ]);
    expect(prompt).toContain("Maintenance");
    expect(prompt).toContain("Kitchen");
    expect(prompt).toContain("Housekeeping");
  });

  test("includes the guest request text", () => {
    const prompt = buildClassifyPrompt("My faucet is leaking", ["Maintenance"]);
    expect(prompt).toContain("My faucet is leaking");
  });

  test("includes urgency rules", () => {
    const prompt = buildClassifyPrompt("test", ["Maintenance"]);
    expect(prompt).toContain("critical");
    expect(prompt).toContain("high");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("low");
  });

  test("includes JSON structure instruction", () => {
    const prompt = buildClassifyPrompt("test", ["Maintenance"]);
    expect(prompt).toContain("translated");
    expect(prompt).toContain("department");
    expect(prompt).toContain("urgency");
    expect(prompt).toContain("summary");
  });

  test("includes examples for each department type", () => {
    const prompt = buildClassifyPrompt("test", [
      "Maintenance",
      "Kitchen / Room Service",
      "Housekeeping",
      "Concierge",
      "Front Desk",
    ]);
    expect(prompt).toContain("bottle of water");
    expect(prompt).toContain("extra towels");
    expect(prompt).toContain("leaking faucet");
    expect(prompt).toContain("restaurant recommendation");
    expect(prompt).toContain("wifi password");
  });

  test("handles empty departments array", () => {
    const prompt = buildClassifyPrompt("test", []);
    expect(prompt).toBeString();
    expect(prompt).toContain("test");
  });

  test("handles special characters in request text", () => {
    const prompt = buildClassifyPrompt(
      'Guest says "help!" & needs <urgent> assistance',
      ["Maintenance"],
    );
    expect(prompt).toContain("help!");
    expect(prompt).toContain("<urgent>");
  });

  test("numbers departments sequentially", () => {
    const prompt = buildClassifyPrompt("test", ["A", "B", "C"]);
    expect(prompt).toContain('1. "A"');
    expect(prompt).toContain('2. "B"');
    expect(prompt).toContain('3. "C"');
  });

  test("includes safety-related urgency descriptions", () => {
    const prompt = buildClassifyPrompt("test", ["Maintenance"]);
    expect(prompt).toContain("safety hazard");
    expect(prompt).toContain("flood");
    expect(prompt).toContain("fire");
    expect(prompt).toContain("medical emergency");
  });

  test("instructs to respond with ONLY valid JSON", () => {
    const prompt = buildClassifyPrompt("test", ["Maintenance"]);
    expect(prompt).toContain("ONLY valid JSON");
  });
});
