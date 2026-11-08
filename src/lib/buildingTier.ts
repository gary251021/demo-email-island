export type BuildingTier = 1 | 2 | 3 | 4;

export function getBuildingTier(unreadCount: number): BuildingTier | null {
  if (unreadCount === 0) return null;
  if (unreadCount < 3) return 1;
  if (unreadCount < 10) return 2;
  if (unreadCount < 30) return 3;
  return 4;
}
