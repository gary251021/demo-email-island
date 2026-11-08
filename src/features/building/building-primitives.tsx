import { ExtrudeGeometry, Shape } from "three";
type Point = [number, number, number];
export const stone = "#d8c9aa";
export const darkStone = "#b7aa93";
export const timber = "#97704f";
export const darkTimber = "#684d3d";
export const slate = "#667b90";
export const cream = "#f0dec0";

const gableShape = new Shape();
gableShape.moveTo(-0.5, 0);
gableShape.lineTo(0, 0.5);
gableShape.lineTo(0.5, 0);
gableShape.closePath();
const gable = new ExtrudeGeometry(gableShape, {
  depth: 1,
  bevelEnabled: false,
});
gable.translate(0, 0, -0.5);

const archShape = new Shape();
archShape.moveTo(-1, 0);
archShape.absarc(0, 0, 1, Math.PI, 0, true);
archShape.closePath();
export const arch = new ExtrudeGeometry(archShape, {
  depth: 1,
  bevelEnabled: false,
});
arch.translate(0, 0, -0.5);

export function Block({
  at,
  size,
  color,
  rotation,
}: {
  at: Point;
  size: Point;
  color: string;
  rotation?: Point;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
}

export function Roof({
  at,
  size,
  color,
}: {
  at: Point;
  size: Point;
  color: string;
}) {
  return (
    <mesh geometry={gable} position={at} scale={size} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </mesh>
  );
}

export function Door({
  at,
  size = [0.23, 0.43, 0.035],
}: {
  at: Point;
  size?: Point;
}) {
  return (
    <group position={at}>
      <Block at={[0, 0, 0]} size={size} color={darkTimber} />
      <Block
        at={[0.045, 0, 0.025]}
        size={[0.025, 0.025, 0.015]}
        color="#d9b574"
      />
    </group>
  );
}

export function Window({ at }: { at: Point }) {
  return (
    <group position={at}>
      <Block at={[0, 0, 0]} size={[0.16, 0.2, 0.035]} color={darkTimber} />
      <Block at={[0, 0, 0.025]} size={[0.105, 0.14, 0.02]} color="#c0c9bc" />
      <Block at={[0, 0, 0.04]} size={[0.022, 0.14, 0.02]} color={timber} />
    </group>
  );
}

export function Crates({ at }: { at: Point }) {
  return (
    <group position={at}>
      <Block at={[0, 0.12, 0]} size={[0.24, 0.24, 0.24]} color="#cda26e" />
      <Block at={[0, 0.12, 0.125]} size={[0.03, 0.24, 0.015]} color={cream} />
      <Block at={[0, 0.12, 0.125]} size={[0.24, 0.025, 0.015]} color={cream} />
      <Block at={[0.28, 0.09, 0.03]} size={[0.2, 0.18, 0.22]} color="#b88c5f" />
    </group>
  );
}
