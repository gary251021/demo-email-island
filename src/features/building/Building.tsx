import type { DomainId } from "../../lib/mailbox";
import { getBuildingTier } from "../../lib/buildingTier";
import { BuildingFamily } from "./BuildingFamily";
import {
  Block,
  Roof,
  Door,
  Window,
  Crates,
  stone,
  darkStone,
  timber,
  darkTimber,
  cream,
  arch,
} from "./building-primitives";

type BuildingProps = {
  domainId: DomainId;
  unreadCount: number;
  hasPendingReply?: boolean;
};
export function Building({
  domainId,
  unreadCount,
  hasPendingReply = false,
}: BuildingProps) {
  const roofColor = hasPendingReply ? "#b75f50" : "#577d9b";
  const tier = getBuildingTier(unreadCount);
  let structure;
  if (tier === null)
    structure = (
      <group>
        {[-0.72, 0.72].map((x) => (
          <Block
            key={x}
            at={[x, 0.12, 0]}
            size={[0.13, 0.16, 1.35]}
            color={stone}
          />
        ))}
        {[-0.61, 0.61].map((z) => (
          <Block
            key={z}
            at={[0, 0.12, z]}
            size={[1.5, 0.16, 0.13]}
            color={stone}
          />
        ))}
      </group>
    );
  else if (tier === 1)
    structure = <Starter domainId={domainId} roofColor={roofColor} />;
  else
    structure = (
      <>
        <BuildingFamily domainId={domainId} tier={tier} roofColor={roofColor} />
        {tier >= 3 && domainId === "finance-bills" && (
          <mesh position={[0, 1.04, 0]} castShadow>
            <sphereGeometry
              args={[0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color={roofColor} roughness={1} flatShading />
          </mesh>
        )}
        {tier >= 3 && (
          <Expansion domainId={domainId} side={-1} roofColor={roofColor} />
        )}
        {tier === 4 && (
          <Expansion domainId={domainId} side={1} roofColor={roofColor} />
        )}
      </>
    );
  return (
    <group rotation={[0, -0.28, 0]}>
      <Block at={[0, 0.04, 0]} size={[1.8, 0.08, 1.5]} color={darkStone} />
      {structure}
    </group>
  );
}

function Starter({
  domainId,
  roofColor,
}: {
  domainId: DomainId;
  roofColor: string;
}) {
  if (domainId === "newsletters")
    return (
      <group>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.23, 0.34, 0.8, 10]} />
          <meshStandardMaterial color={cream} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 1, 0]} castShadow>
          <coneGeometry args={[0.36, 0.38, 10]} />
          <meshStandardMaterial color={roofColor} roughness={1} flatShading />
        </mesh>
        <group position={[0, 0.85, 0.3]} rotation={[0, 0, 0.35]}>
          {[0, Math.PI / 2].map((angle) => (
            <Block
              key={angle}
              at={[0, 0, 0]}
              size={[0.12, 1.25, 0.04]}
              color={timber}
              rotation={[0, 0, angle]}
            />
          ))}
        </group>
      </group>
    );
  if (domainId === "social-events")
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <coneGeometry args={[0.7, 0.8, 8, 1, true]} />
          <meshStandardMaterial
            color={roofColor}
            roughness={1}
            side={2}
            flatShading
          />
        </mesh>
        {[-0.5, 0.5].flatMap((x) =>
          [-0.35, 0.35].map((z) => (
            <Block
              key={`${x}-${z}`}
              at={[x, 0.25, z]}
              size={[0.05, 0.5, 0.05]}
              color={timber}
            />
          )),
        )}
      </group>
    );
  if (domainId === "finance-bills")
    return (
      <group>
        <Block at={[0, 0.3, 0]} size={[0.85, 0.5, 0.8]} color={stone} />
        <mesh
          geometry={arch}
          position={[0, 0.55, 0]}
          scale={[0.43, 0.33, 0.85]}
          castShadow
        >
          <meshStandardMaterial color={roofColor} roughness={1} />
        </mesh>
        <Door at={[0, 0.28, 0.42]} />
      </group>
    );
  if (domainId === "internal-team" || domainId === "shopping-delivery")
    return (
      <group>
        <Block at={[0, 0.1, 0]} size={[1.15, 0.12, 1]} color={timber} />
        {[-0.46, 0.46].flatMap((x) =>
          [-0.36, 0.36].map((z) => (
            <Block
              key={`${x}-${z}`}
              at={[x, 0.43, z]}
              size={[0.07, 0.7, 0.07]}
              color={darkTimber}
            />
          )),
        )}
        <Roof at={[0, 0.78, 0]} size={[1.2, 0.55, 1.08]} color={roofColor} />
        {domainId === "internal-team" ? (
          <group>
            <Block
              at={[0, 0.48, -0.34]}
              size={[0.83, 0.48, 0.05]}
              color="#cba783"
            />
            <Block
              at={[-0.72, 0.47, 0.4]}
              size={[0.4, 0.35, 0.06]}
              color={darkTimber}
            />
            <Block
              at={[-0.72, 0.47, 0.44]}
              size={[0.28, 0.23, 0.02]}
              color={cream}
            />
            <Block
              at={[-0.72, 0.22, 0.4]}
              size={[0.05, 0.45, 0.05]}
              color={timber}
            />
          </group>
        ) : (
          <group>
            <Crates at={[-0.3, 0.16, 0.1]} />
            <Crates at={[0.2, 0.16, -0.2]} />
          </group>
        )}
      </group>
    );
  const flat = domainId === "low-priority";
  if (domainId === "system-alerts")
    return (
      <group>
        {[-0.3, 0.3].flatMap((x) =>
          [-0.3, 0.3].map((z) => (
            <group key={`${x}-${z}`}>
              <Block
                at={[x, 0.12, z]}
                size={[0.18, 0.24, 0.18]}
                color="#b27f64"
              />
              <Block
                at={[x, 0.65, z]}
                size={[0.07, 1.1, 0.07]}
                color={timber}
              />
            </group>
          )),
        )}
        <Block at={[0, 0.65, 0]} size={[0.75, 0.07, 0.7]} color={timber} />
        <Roof at={[0, 1.2, 0]} size={[0.9, 0.4, 0.85]} color={roofColor} />
        <Block
          at={[0, 0.95, 0.3]}
          size={[0.05, 0.65, 0.05]}
          color={timber}
          rotation={[0, 0, 0.7]}
        />
      </group>
    );
  return (
    <group>
      <Block
        at={[0, 0.34, 0]}
        size={[0.85, 0.58, 0.75]}
        color={flat ? "#d9be94" : stone}
      />
      {flat ? (
        <Block at={[0, 0.66, 0]} size={[1.05, 0.12, 0.95]} color={roofColor} />
      ) : (
        <Roof at={[0, 0.63, 0]} size={[1.05, 0.55, 0.95]} color={roofColor} />
      )}
      <Door at={[0, 0.28, 0.39]} />
    </group>
  );
}

function Expansion({
  domainId,
  side,
  roofColor,
}: {
  domainId: DomainId;
  side: -1 | 1;
  roofColor: string;
}) {
  const flat = domainId === "low-priority";
  const team = domainId === "internal-team";
  const finance = domainId === "finance-bills";
  let wallColor = stone;
  if (flat) wallColor = "#d9be94";
  if (team) wallColor = "#cba783";
  if (domainId === "system-alerts") wallColor = "#b27f64";
  if (domainId === "shopping-delivery") wallColor = "#ac8261";
  return (
    <group position={[side * 0.85, 0, -0.25]}>
      {domainId === "social-events" ? (
        <group scale={[0.65, 0.65, 0.65]}>
          <BuildingFamily
            domainId="social-events"
            tier={2}
            roofColor={roofColor}
          />
        </group>
      ) : (
        <>
          <Block at={[0, 0.38, 0]} size={[0.8, 0.68, 0.85]} color={wallColor} />
          {flat ? (
            <Block at={[0, 0.78, 0]} size={[1, 0.14, 1.05]} color={roofColor} />
          ) : null}
          {finance && (
            <mesh position={[0, 0.75, 0]} castShadow>
              <sphereGeometry
                args={[0.52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                color={roofColor}
                roughness={1}
                flatShading
              />
            </mesh>
          )}
          {!flat && !finance && domainId !== "newsletters" && (
            <Roof at={[0, 0.72, 0]} size={[1, 0.62, 1.05]} color={roofColor} />
          )}
          <Window at={[0, 0.47, 0.45]} />
          {domainId === "core-projects" && (
            <Block
              at={[0, 1.05, -0.2]}
              size={[0.38, 1.1, 0.4]}
              color={darkStone}
            />
          )}
          {domainId === "newsletters" &&
            [0, 0.3, 0.6].map((z) => (
              <Roof
                key={z}
                at={[0, 0.75, z - 0.3]}
                size={[0.95, 0.4, 0.32]}
                color={roofColor}
              />
            ))}
          {domainId === "system-alerts" && (
            <Block at={[0, 1.15, 0]} size={[0.06, 1.1, 0.06]} color={timber} />
          )}
          {domainId === "shopping-delivery" && (
            <group>
              <Block at={[0, 1.1, 0]} size={[0.08, 1.5, 0.08]} color={timber} />
              <Block
                at={[0.3, 1.8, 0]}
                size={[0.75, 0.08, 0.08]}
                color={timber}
              />
            </group>
          )}
        </>
      )}
    </group>
  );
}
