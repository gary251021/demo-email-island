import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import {
  ExtrudeGeometry,
  Shape,
  Box3,
  Vector3,
  OrthographicCamera as ThreeOrthographicCamera,
} from "three";
import type { DomainId, Overview } from "../../lib/mailbox";
import { Building } from "../building/Building";
import { SceneLabels } from "./SceneLabels";
import {
  tileRadius as radius,
  tilePositions,
  subcategoryPosition,
} from "./scene-layout";

type Domain = Overview["domains"][number];
type IslandSceneProps = {
  ownerKey: string;
  onUnauthenticated: () => void;
  domains: Overview["domains"];
  domain?: Domain;
  panelOpen: boolean;
  selectedSubcategory?: string;
  onDomain: (domainId: DomainId) => void;
  onSubcategory: (subcategoryId: string) => void;
};

const terrainColors: Record<DomainId, string> = {
  "core-projects": "#c6e45d",
  "internal-team": "#94b19a",
  newsletters: "#c0bf88",
  "finance-bills": "#b7ba8f",
  "system-alerts": "#b8a197",
  "social-events": "#a7bc91",
  "shopping-delivery": "#9fb9aa",
  "low-priority": "#d6ba8e",
};

export function IslandScene(props: IslandSceneProps) {
  const queryClient = useQueryClient();
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  return (
    <div className="scene-canvas">
      <div ref={setPortal} className="scene-html" />
      {portal && (
        <Canvas
          orthographic
          shadows
          dpr={[1, 1.5]}
          frameloop="demand"
          camera={{ position: [0, 14, 12], near: 0.1, far: 100, zoom: 70 }}
          gl={{ antialias: true }}
          fallback={
            <p className="scene-message">
              無法開啟立體群島，請使用支援 WebGL 的瀏覽器。
            </p>
          }
        >
          <color attach="background" args={["#45afc4"]} />
          <SceneLabels
            {...props}
            queryClient={queryClient}
            portal={{ current: portal }}
          />
          <CameraFraming
            singleTile={Boolean(props.domain)}
            panelOpen={props.panelOpen}
          />
          <ambientLight intensity={0.7} />
          <hemisphereLight args={["#f7efd9", "#748d88", 0.65]} />
          <directionalLight
            position={[-7, 12, 7]}
            intensity={2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
            shadow-normalBias={0.04}
            shadow-bias={-0.0001}
            shadow-radius={4}
          />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.37, 0]}
            receiveShadow
          >
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial color="#45afc4" />
          </mesh>
          {props.domain ? (
            <DomainBoard {...props} domain={props.domain} />
          ) : (
            <Archipelago {...props} />
          )}
        </Canvas>
      )}
    </div>
  );
}

function CameraFraming({
  singleTile,
  panelOpen,
}: {
  singleTile: boolean;
  panelOpen: boolean;
}) {
  useFrame(({ scene, size, camera }) => {
    if (!(camera instanceof ThreeOrthographicCamera)) return;
    const board = scene.getObjectByName("domain-board");
    const center = new Vector3();
    let spanX = 20,
      spanY = 11.5;
    if (singleTile && board) {
      const box = new Box3();
      board.traverse((object) => {
        if (object.name === "island-terrain")
          box.union(new Box3().setFromObject(object));
        if (object.name.startsWith("building-")) {
          const anchor = object.getWorldPosition(new Vector3());
          // Fixed family headroom keeps the camera still when reading changes a tier.
          anchor.y += 1.7;
          box.union(
            new Box3().setFromCenterAndSize(anchor, new Vector3(3.6, 4.2, 3.6)),
          );
        }
      });
      box.getCenter(center);
      const dimensions = box.getSize(new Vector3());
      spanX = dimensions.x + 2;
      spanY =
        dimensions.y * (12 / Math.sqrt(340)) +
        dimensions.z * (14 / Math.sqrt(340)) +
        2;
    }
    const panelSpace = panelOpen && size.width > 700 ? 440 : 0;
    const freeWidth = size.width - panelSpace;
    const freeHeight = singleTile
      ? Math.max(300, size.height - 220)
      : size.height;
    const zoom = Math.min(freeWidth / spanX, freeHeight / spanY);
    center.x += panelSpace / 2 / zoom;
    camera.position.set(center.x, center.y + 14, center.z + 12);
    camera.lookAt(center);
    camera.zoom = zoom;
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, -1);
  return (
    <OrthographicCamera
      makeDefault
      manual
      position={[0, 14, 12]}
      near={0.1}
      far={100}
      zoom={70}
    />
  );
}

function Terrain({ color, scale = 1 }: { color: string; scale?: number }) {
  const geometry = useMemo(() => {
    const outline = new Shape();
    for (let index = 0; index < 6; index++) {
      const angle = Math.PI / 6 + (index * Math.PI) / 3;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) outline.moveTo(x, y);
      else outline.lineTo(x, y);
    }
    outline.closePath();
    return new ExtrudeGeometry(outline, {
      depth: 0.23,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 1,
      steps: 1,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group name="island-terrain" scale={[scale, 1, scale]}>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.25, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#d2bfa3" roughness={1} flatShading />
      </mesh>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.205, 0]}
        scale={[0.967, 0.967, 0.95]}
        receiveShadow
      >
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function Archipelago({ domains, onDomain }: IslandSceneProps) {
  return (
    <group position={[-1.6, 0, 0]}>
      {domains.map((domain) => (
        <group key={domain.id} position={tilePositions[domain.id]}>
          <Terrain color={terrainColors[domain.id]} />
          <group
            position={[0, 0.07, 0.04]}
            scale={0.66}
            onClick={(event) => {
              event.stopPropagation();
              onDomain(domain.id);
            }}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <Building
              domainId={domain.id}
              unreadCount={domain.unreadCount}
              hasPendingReply={domain.pendingReplyCount > 0}
            />
          </group>
          {domain.id !== "low-priority" && <Trees />}
        </group>
      ))}
    </group>
  );
}

function DomainBoard({
  domain,
  onSubcategory,
}: IslandSceneProps & { domain: Domain }) {
  return (
    <group name="domain-board">
      <Terrain color={terrainColors[domain.id]} scale={2.15} />
      {domain.subcategories.map((subcategory) => (
        <group
          key={subcategory.id}
          position={subcategoryPosition(subcategory.layoutSlot)}
        >
          {subcategory.origin === "split" && (
            <Terrain color={terrainColors[domain.id]} scale={0.8} />
          )}
          <group
            name={`building-${subcategory.id}`}
            position={[0, 0.07, 0]}
            scale={0.84}
            onClick={(event) => {
              event.stopPropagation();
              onSubcategory(subcategory.id);
            }}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <Building
              domainId={domain.id}
              unreadCount={subcategory.unreadCount}
              hasPendingReply={subcategory.pendingReplyCount > 0}
            />
          </group>
        </group>
      ))}
      <group position={[-1.8, 0, 2.6]}>
        <Tree />
      </group>
      <group position={[2.35, 0, -1.3]}>
        <Tree />
      </group>
    </group>
  );
}

function Trees() {
  return (
    <group>
      <group position={[-1.17, 0.06, 0.03]} scale={0.7}>
        <Tree />
      </group>
      <group position={[1.08, 0.06, -0.37]} scale={0.83}>
        <Tree />
      </group>
    </group>
  );
}

function Tree() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.4, 6]} />
        <meshStandardMaterial color="#947254" roughness={1} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <coneGeometry args={[0.27, 0.49, 6]} />
        <meshStandardMaterial color="#75966d" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <coneGeometry args={[0.21, 0.43, 6]} />
        <meshStandardMaterial color="#86a777" roughness={1} flatShading />
      </mesh>
    </group>
  );
}
