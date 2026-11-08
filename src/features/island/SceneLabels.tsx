import { projectedModelBounds, placeLabel } from "./label-layout";
import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { Vector3 } from "three";
import type { DomainId, Overview } from "../../lib/mailbox";
import { QuickArchive } from "../mailbox/QuickArchive";
import { getBuildingTier } from "../../lib/buildingTier";
import { subcategoryPosition, tilePositions } from "./scene-layout";

type Domain = Overview["domains"][number];
type SceneLabelsProps = {
  queryClient: QueryClient;
  ownerKey: string;
  onUnauthenticated: () => void;
  domains: Overview["domains"];
  domain?: Domain;
  selectedSubcategory?: string;
  onDomain: (domainId: DomainId) => void;
  onSubcategory: (subcategoryId: string) => void;
  portal: RefObject<HTMLDivElement>;
};
type Label = {
  key: string;
  position: [number, number, number];
  text: string;
  accessibleName?: string;
  pendingCount?: number;
  unreadCount?: number;
} & (
  | { kind: "domain"; resourceId: DomainId }
  | { kind: "subcategory" | "anchor"; resourceId: string }
  | { kind: "token"; accessibleName: string }
  | { kind: "title" }
);

const projection = new Vector3();
const screenCenter = (
  _object: unknown,
  _camera: unknown,
  size: { width: number; height: number },
) => [size.width / 2, size.height / 2];

export function SceneLabels(props: SceneLabelsProps) {
  const elements = useRef(new Map<string, HTMLDivElement>());
  const placements = useRef(new Map<string, { x: number; y: number }>());
  const invalidate = useThree((state) => state.invalidate);
  const labels = useMemo(
    () => createLabels(props.domains, props.domain),
    [props.domains, props.domain],
  );
  useFrame(({ camera, size, scene }) => {
    const models = projectedModelBounds(
      scene,
      camera,
      size,
      props.domain?.subcategories.map((category) => category.id) ?? [],
    );
    const occupied: DOMRect[] = [...models.values()];
    const ordered = labels.toSorted((a, b) => {
      const ay = new Vector3(...a.position).project(camera).y;
      const by = new Vector3(...b.position).project(camera).y;
      return by - ay;
    });
    for (const label of ordered) {
      const element = elements.current.get(label.key);
      if (!element) continue;
      if (label.kind === "anchor") {
        const model = models.get(label.resourceId);
        const actual = scene.getObjectByName(`building-${label.resourceId}`);
        if (actual)
          element.dataset.worldAnchor = JSON.stringify(
            actual.getWorldPosition(new Vector3()).toArray(),
          );
        if (model)
          element.dataset.modelBounds = JSON.stringify({
            x: model.x,
            y: model.y,
            width: model.width,
            height: model.height,
          });
      }
      positionElement(element, label.position, { camera, size });
      if (
        !props.domain ||
        (label.kind !== "subcategory" && label.kind !== "token")
      ) {
        element.dataset.layoutReady = "true";
        element.style.visibility = "visible";
        continue;
      }
      projection.set(...label.position).project(camera);
      const bounds = element.getBoundingClientRect();
      const desired = {
        x: ((projection.x + 1) * size.width) / 2,
        y: ((-projection.y + 1) * size.height) / 2,
      };
      const frameKey = `${label.key}:${bounds.width}:${bounds.height}:${camera.matrixWorldInverse.elements.join(",")}:${camera.projectionMatrix.elements.join(",")}`;
      const { x, y } = placeLabel(
        {
          desired,
          previous: placements.current.get(frameKey),
          label: bounds,
          size,
        },
        occupied,
      );
      placements.current.set(frameKey, { x, y });
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      const dx = desired.x - x,
        dy = desired.y - y;
      const length = Math.hypot(dx, dy);
      element.style.setProperty(
        "--leader-length",
        `${length > 12 ? length : 0}px`,
      );
      element.style.setProperty("--leader-angle", `${Math.atan2(dy, dx)}rad`);
      element.dataset.layoutReady = "true";
      element.style.visibility = "visible";
    }
  });
  return (
    <Html
      fullscreen
      portal={props.portal}
      calculatePosition={screenCenter}
      style={{ pointerEvents: "none" }}
      zIndexRange={[20, 10]}
    >
      <QueryClientProvider client={props.queryClient}>
        <div className="scene-label-layer">
          {labels.map((label) => (
            <div
              key={label.key}
              className={
                label.kind === "subcategory" || label.kind === "token"
                  ? "scene-label-position placed-label"
                  : "scene-label-position"
              }
              ref={(element) => {
                if (element) {
                  elements.current.set(label.key, element);
                  if (element.dataset.layoutReady !== "true") {
                    element.style.visibility = "hidden";
                    invalidate();
                  }
                } else elements.current.delete(label.key);
              }}
            >
              {label.kind === "domain" && (
                <button
                  type="button"
                  aria-label={label.accessibleName}
                  className="island-label"
                  onClick={() => props.onDomain(label.resourceId)}
                >
                  {label.text}
                  {label.unreadCount === 0 && Boolean(label.pendingCount) && (
                    <span className="pending-token">待回覆</span>
                  )}
                </button>
              )}
              {label.kind === "subcategory" && props.domain && (
                <QuickArchive
                  ownerKey={props.ownerKey}
                  input={{
                    domainId: props.domain.id,
                    subcategoryId: label.resourceId,
                  }}
                  name={label.text}
                  onUnauthenticated={props.onUnauthenticated}
                >
                  <button
                    id={`subcategory-${label.resourceId}`}
                    type="button"
                    className="island-label"
                    aria-label={label.accessibleName}
                    aria-pressed={
                      label.resourceId === props.selectedSubcategory
                    }
                    onClick={() => props.onSubcategory(label.resourceId)}
                  >
                    {label.text}
                  </button>
                  {label.unreadCount === 0 && Boolean(label.pendingCount) && (
                    <span className="pending-token">待回覆</span>
                  )}
                </QuickArchive>
              )}
              {label.kind === "token" && (
                <span
                  className="unread-token"
                  aria-label={label.accessibleName}
                >
                  {label.text}
                </span>
              )}
              {label.kind === "title" && (
                <h1 className="island-label domain-title">{label.text}</h1>
              )}
              {label.kind === "anchor" && (
                <span
                  className="building-anchor"
                  data-building={label.resourceId}
                />
              )}
            </div>
          ))}
        </div>
      </QueryClientProvider>
    </Html>
  );
}

function createLabels(domains: Overview["domains"], domain?: Domain): Label[] {
  if (!domain)
    return domains.flatMap((item) => {
      const [x, , z] = tilePositions[item.id];
      const shiftedX = x - 1.6;
      const labelZ = item.id === "system-alerts" ? -1.85 : -1.55;
      return [
        {
          key: `domain-${item.id}`,
          kind: "domain",
          text: item.name,
          unreadCount: item.unreadCount,
          pendingCount: item.pendingReplyCount,
          accessibleName: buildingName(
            item.name,
            item.unreadCount,
            item.pendingReplyCount,
          ),
          resourceId: item.id,
          position: [shiftedX, 0.12, z + labelZ],
        },
        {
          key: `token-${item.id}`,
          kind: "token",
          text: `未讀 ${item.unreadCount}`,
          accessibleName: `${item.name}未讀 ${item.unreadCount}`,
          position: [shiftedX, 0.09, z + 1.17],
        },
        {
          key: `anchor-${item.id}`,
          kind: "anchor",
          text: "",
          resourceId: item.id,
          position: [shiftedX, 0.2, z + 0.15],
        },
      ];
    });

  const labels: Label[] = [];
  domain.subcategories.forEach((subcategory) => {
    const position = subcategoryPosition(subcategory.layoutSlot);
    const [x, , z] = position;
    labels.push(
      {
        key: `subcategory-${subcategory.id}`,
        kind: "subcategory",
        text: subcategory.name,
        unreadCount: subcategory.unreadCount,
        pendingCount: subcategory.pendingReplyCount,
        accessibleName: buildingName(
          subcategory.name,
          subcategory.unreadCount,
          subcategory.pendingReplyCount,
        ),
        resourceId: subcategory.id,
        position: [x, 0.14, z - 1.9],
      },
      {
        key: `token-${subcategory.id}`,
        kind: "token",
        text: `未讀 ${subcategory.unreadCount}`,
        accessibleName: `${subcategory.name}未讀 ${subcategory.unreadCount}`,
        position: [x, 0.12, z + 1.1],
      },
      {
        key: `anchor-${subcategory.id}`,
        kind: "anchor",
        text: "",
        resourceId: subcategory.id,
        position: [x, 0.2, z + 0.15],
      },
    );
  });
  return labels;
}

function positionElement(
  element: HTMLDivElement,
  position: Label["position"],
  { camera, size }: Pick<RootState, "camera" | "size">,
) {
  projection.set(...position).project(camera);
  element.style.transform = `translate(${((projection.x + 1) * size.width) / 2}px, ${((-projection.y + 1) * size.height) / 2}px) translate(-50%, -50%)`;
}

function buildingName(name: string, count: number, pending: number) {
  const tier = getBuildingTier(count);
  const level = tier === null ? "地基" : `Lv. ${tier}`;
  return `${name}，未讀 ${count} 封，待回覆 ${pending} 封，${level}`;
}
