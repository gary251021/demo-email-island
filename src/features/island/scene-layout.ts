import type { DomainId } from "../../lib/mailbox";

export const tileRadius = 2;
const width = Math.sqrt(3) * tileRadius;
export const tilePositions: Record<DomainId, [number, number, number]> = {
  "internal-team": [-width / 2, 0, -3],
  "core-projects": [width / 2, 0, -3],
  "social-events": [-width, 0, 0],
  "finance-bills": [0, 0, 0],
  newsletters: [width, 0, 0],
  "shopping-delivery": [-width / 2, 0, 3],
  "system-alerts": [width / 2, 0, 3],
  "low-priority": [7.5, 0, 4.05],
};

export function subcategoryPositions(
  count: number,
): [number, number, number][] {
  if (count === 1) return [[0, 0, 0]];
  if (count === 2)
    return [
      [-1.65, 0, 0],
      [1.65, 0, 0],
    ];
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(angle) * 2.05, 0, Math.sin(angle) * 2.05];
  });
}
