/**
 * Fuzzy department matching logic extracted from classification processor.
 *
 * Match priority:
 *   1. exact name match (case-insensitive)
 *   2. slug match (case-insensitive)
 *   3. slug contained in AI response
 *   4. AI response contained in department name
 *   5. first word of department name contained in AI response
 */

export interface Department {
  id: string;
  name: string;
  slug: string;
}

export function matchDepartment(
  aiDepartment: string,
  departments: Department[],
): Department | undefined {
  if (!departments.length) return undefined;

  const deptLower = aiDepartment.toLowerCase().trim();

  return (
    departments.find((d) => d.name.toLowerCase() === deptLower) ||
    departments.find((d) => d.slug.toLowerCase() === deptLower) ||
    departments.find((d) => deptLower.includes(d.slug.toLowerCase())) ||
    departments.find((d) => d.name.toLowerCase().includes(deptLower)) ||
    departments.find((d) =>
      deptLower.includes(d.name.toLowerCase().split(" ")[0]),
    )
  );
}
