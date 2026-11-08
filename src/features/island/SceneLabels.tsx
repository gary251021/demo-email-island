import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { Vector3 } from "three";
import type { DomainId, Overview } from "../../lib/mailbox";
import { getBuildingTier } from "../../lib/buildingTier";
import { subcategoryPositions, tilePositions } from "./scene-layout";

type Domain = Overview["domains"][number];
type SceneLabelsProps = {
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
  const get = useThree((state) => state.get);
  const labels = useMemo(
    () => createLabels(props.domains, props.domain),
    [props.domains, props.domain],
  );
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const element = elements.current.get(label.key);
      if (!element) continue;
      positionElement(element, label.position, { camera, size });
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
      <div className="scene-label-layer">
        {labels.map((label) => (
          <div
            key={label.key}
            className="scene-label-position"
            ref={(element) => {
              if (element) {
                elements.current.set(label.key, element);
                positionElement(element, label.position, get());
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
              </button>
            )}
            {label.kind === "subcategory" && (
              <button
                id={`subcategory-${label.resourceId}`}
                type="button"
                className="island-label"
                aria-label={label.accessibleName}
                aria-pressed={label.resourceId === props.selectedSubcategory}
                onClick={() => props.onSubcategory(label.resourceId)}
              >
                {label.text}
              </button>
            )}
            {label.kind === "token" && (
              <span className="unread-token" aria-label={label.accessibleName}>
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
          accessibleName: buildingName(item.name, item.unreadCount),
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
  const positions = subcategoryPositions(domain.subcategories.length);
  const labels: Label[] = [
    {
      key: "domain-title",
      kind: "title",
      text: domain.name,
      position: [0, 0.1, -3.4],
    },
  ];
  domain.subcategories.forEach((subcategory, index) => {
    const position = positions[index];
    if (!position) return;
    const [x, , z] = position;
    labels.push(
      {
        key: `subcategory-${subcategory.id}`,
        kind: "subcategory",
        text: subcategory.name,
        accessibleName: buildingName(subcategory.name, subcategory.unreadCount),
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

function buildingName(name: string, count: number) {
  const tier = getBuildingTier(count);
  const level = tier === null ? "地基" : `Lv. ${tier}`;
  return `${name}，未讀 ${count} 封，${level}`;
}
