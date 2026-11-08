import { Box3, Vector3 } from "three";
import type { Camera, Object3D } from "three";
type Viewport = { width: number; height: number };
type Point = { x: number; y: number };
type LabelSize = { width: number; height: number };
export function projectedModelBounds(
  scene: Object3D,
  camera: Camera,
  size: Viewport,
  ids: string[],
) {
  const bounds = new Map<string, DOMRect>();
  for (const id of ids) {
    const model = scene.getObjectByName(`building-${id}`);
    if (model)
      bounds.set(id, projectBox(new Box3().setFromObject(model), camera, size));
  }
  return bounds;
}
function projectBox(box: Box3, camera: Camera, size: Viewport) {
  const points = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const point = new Vector3(x, y, z).project(camera);
        points.push({
          x: ((point.x + 1) * size.width) / 2,
          y: ((1 - point.y) * size.height) / 2,
        });
      }
  const left = Math.min(...points.map((point) => point.x)) - 3;
  const top = Math.min(...points.map((point) => point.y)) - 3;
  return new DOMRect(
    left,
    top,
    Math.max(...points.map((point) => point.x)) - left + 3,
    Math.max(...points.map((point) => point.y)) - top + 3,
  );
}

const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right + 4 &&
  a.right > b.left - 4 &&
  a.top < b.bottom + 4 &&
  a.bottom > b.top - 4;
// Choose the closest free rectangle around actual model silhouettes and other pills.
type PlacementRequest = {
  desired: Point;
  previous?: Point;
  label: LabelSize;
  size: Viewport;
};
export function placeLabel(
  { desired, previous, label, size }: PlacementRequest,
  occupied: DOMRect[],
) {
  if (previous) {
    const rectangle = new DOMRect(
      previous.x - label.width / 2,
      previous.y - label.height / 2,
      label.width,
      label.height,
    );
    if (!occupied.some((box) => intersects(rectangle, box))) {
      occupied.push(rectangle);
      return previous;
    }
  }
  const minX = label.width / 2 + 10,
    maxX = size.width - label.width / 2 - 10;
  const minY = 170 + label.height / 2,
    maxY = size.height - label.height / 2 - 16;
  const xs = new Set([Math.min(maxX, Math.max(minX, desired.x)), minX, maxX]);
  const ys = new Set([Math.min(maxY, Math.max(minY, desired.y)), minY, maxY]);
  for (const box of occupied) {
    xs.add(box.left - label.width / 2 - 5);
    xs.add(box.right + label.width / 2 + 5);
    ys.add(box.top - label.height / 2 - 5);
    ys.add(box.bottom + label.height / 2 + 5);
  }
  let best: Point | undefined;
  let cost = Infinity;
  for (const x of xs) {
    if (x < minX || x > maxX) continue;
    for (const y of ys) {
      if (y < minY || y > maxY) continue;
      const rect = new DOMRect(
        x - label.width / 2,
        y - label.height / 2,
        label.width,
        label.height,
      );
      if (occupied.some((box) => intersects(rect, box))) continue;
      const distance = (x - desired.x) ** 2 + (y - desired.y) ** 2;
      if (distance < cost) {
        best = { x, y };
        cost = distance;
      }
    }
  }
  const result = best ?? desired;
  occupied.push(
    new DOMRect(
      result.x - label.width / 2,
      result.y - label.height / 2,
      label.width,
      label.height,
    ),
  );
  return result;
}
