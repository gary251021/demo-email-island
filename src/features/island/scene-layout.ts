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

// Slots are persistent, never inferred from the current category count.
export function subcategoryPosition(slot: number): [number, number, number] {
  if (slot === 0) return [-1.8, 0, 0];
  if (slot === 1) return [1.8, 0, 0];
  let ring = 1,
    index = slot - 2;
  while (index >= ring * 8) {
    index -= ring * 8;
    ring++;
  }
  const angle = (index / (ring * 8)) * Math.PI * 2 - Math.PI / 2;
  return [
    Math.cos(angle) * (6.5 + 5.2 * (ring - 1)),
    0,
    Math.sin(angle) * (6.5 + 5.2 * (ring - 1)),
  ];
}
