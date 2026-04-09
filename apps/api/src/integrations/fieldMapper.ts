/**
 * Field Mapping + Transform Engine
 *
 * Transforms HospiQ workflow data to external formats using configurable
 * field mappings with dot-notation source paths and built-in transforms.
 */

export interface FieldMapping {
  sourceField: string; // e.g., "workflow.priority"
  targetField: string; // e.g., "urgency_level"
  transform: string; // e.g., "map:{critical:1,high:2,medium:3,low:4}"
}

const ISO639_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  tr: "Turkish",
  nl: "Dutch",
  sv: "Swedish",
  pl: "Polish",
  th: "Thai",
  vi: "Vietnamese",
};

/**
 * Resolve a dot-notation path from a nested object.
 * e.g. resolveField({ a: { b: 3 } }, "a.b") => 3
 */
function resolveField(data: any, path: string): any {
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Parse and apply a transform string to a value.
 */
function applyTransform(value: any, transform: string): any {
  if (!transform || transform === "none") {
    return value;
  }

  if (transform === "uppercase") {
    return typeof value === "string" ? value.toUpperCase() : value;
  }

  if (transform === "lowercase") {
    return typeof value === "string" ? value.toLowerCase() : value;
  }

  if (transform.startsWith("truncate:")) {
    const maxLen = parseInt(transform.slice(9), 10);
    if (typeof value === "string" && !isNaN(maxLen)) {
      return value.slice(0, maxLen);
    }
    return value;
  }

  if (transform.startsWith("prefix:")) {
    const prefix = transform.slice(7).replace(/^"|"$/g, "");
    return `${prefix}${value ?? ""}`;
  }

  if (transform.startsWith("suffix:")) {
    const suffix = transform.slice(7).replace(/^"|"$/g, "");
    return `${value ?? ""}${suffix}`;
  }

  if (transform.startsWith("map:")) {
    const mapStr = transform.slice(4);
    // Parse {key:value,key2:value2}
    const inner = mapStr.replace(/^\{|\}$/g, "");
    const entries = inner.split(",");
    const map: Record<string, string> = {};
    for (const entry of entries) {
      const colonIdx = entry.indexOf(":");
      if (colonIdx > -1) {
        map[entry.slice(0, colonIdx).trim()] = entry.slice(colonIdx + 1).trim();
      }
    }
    const key = String(value);
    return key in map ? map[key] : value;
  }

  if (transform === "iso8601") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString();
    }
    return value;
  }

  if (transform === "iso639_to_name") {
    if (typeof value === "string") {
      return ISO639_NAMES[value.toLowerCase()] ?? value;
    }
    return value;
  }

  // Unknown transform — pass through
  return value;
}

/**
 * Apply an array of field mappings to source data, returning a flat target object.
 */
export function applyMappings(
  data: any,
  mappings: FieldMapping[],
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of mappings) {
    const rawValue = resolveField(data, mapping.sourceField);
    result[mapping.targetField] = applyTransform(rawValue, mapping.transform);
  }

  return result;
}
