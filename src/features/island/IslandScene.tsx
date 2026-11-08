import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { ExtrudeGeometry, Shape } from "three";
import type { DomainId, Overview } from "../../lib/mailbox";
import { Building } from "../building/Building";
import { SceneLabels } from "./SceneLabels";
import {
  tileRadius as radius,
  tilePositions,
  subcategoryPositions,
} from "./scene-layout";

type Domain = Overview["domains"][number];
type IslandSceneProps = {
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
          <SceneLabels {...props} portal={{ current: portal }} />
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
  const { size } = useThree();
  const freeWidth = panelOpen
    ? Math.max(size.width - 440, size.width * 0.45)
    : size.width;
  const zoom = Math.min(
    freeWidth / (singleTile ? 11.4 : 20),
    size.height / (singleTile ? 8.5 : 11.5),
  );
  const offset = (size.width - freeWidth) / 2 / zoom;
  return (
    <OrthographicCamera
      makeDefault
      manual
      position={[0, 14, 12]}
      near={0.1}
      far={100}
      zoom={zoom}
      left={-size.width / 2 + offset}
      right={size.width / 2 + offset}
      top={size.height / 2}
      bottom={-size.height / 2}
      onUpdate={(camera) => {
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }}
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
    <group scale={[scale, 1, scale]}>
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
            <Building domainId={domain.id} unreadCount={domain.unreadCount} />
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
  const placements = subcategoryPositions(domain.subcategories.length);
  return (
    <group>
      <Terrain color={terrainColors[domain.id]} scale={2.15} />
      {domain.subcategories.map((subcategory, index) => (
        <group key={subcategory.id} position={placements[index]}>
          <group
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
