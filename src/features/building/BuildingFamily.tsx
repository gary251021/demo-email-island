import type { DomainId } from "../../lib/mailbox";
import type { BuildingTier } from "../../lib/buildingTier";
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
export function BuildingFamily({
  domainId,
  tier,
  roofColor,
}: {
  domainId: DomainId;
  tier: BuildingTier;
  roofColor: string;
}) {
  const models = {
    "core-projects": <Workshop roofColor={roofColor} tower={tier >= 3} />,
    "internal-team": <Guildhall roofColor={roofColor} bell={tier >= 3} />,
    newsletters: (
      <Windmill roofColor={roofColor} printing={tier >= 3} tall={tier === 4} />
    ),
    "finance-bills": <Treasury roofColor={roofColor} />,
    "system-alerts": <SignalTower roofColor={roofColor} />,
    "social-events": <Canopy roofColor={roofColor} />,
    "shopping-delivery": <Harbor roofColor={roofColor} />,
    "low-priority": <SortingHouse roofColor={roofColor} />,
  };
  return models[domainId];
}

function Workshop({ tower, roofColor }: { tower: boolean; roofColor: string }) {
  return (
    <group>
      <Block at={[0, 0.07, 0]} size={[1.7, 0.14, 1.3]} color={darkStone} />
      <Block at={[-0.2, 0.48, 0.03]} size={[1.12, 0.75, 0.91]} color={stone} />
      <Roof
        at={[-0.2, 0.85, 0.03]}
        size={[1.35, 0.9, 1.13]}
        color={roofColor}
      />
      <Block
        at={[-0.2, 1.3, 0.03]}
        size={[0.055, 0.045, 1.15]}
        color="#8b98a1"
      />
      <Door at={[-0.25, 0.34, 0.505]} />
      <Window at={[0.15, 0.59, 0.505]} />
      <Window at={[-0.55, 0.59, 0.505]} />
      {tower && (
        <group>
          {" "}
          <Block
            at={[0.51, 0.79, -0.22]}
            size={[0.45, 1.4, 0.5]}
            color={darkStone}
          />
          <Block
            at={[0.51, 1.52, -0.22]}
            size={[0.57, 0.13, 0.61]}
            color={stone}
          />
          {[-0.2, 0.2].flatMap((x) =>
            [-0.22, 0.22].map((z) => (
              <Block
                key={`${x}-${z}`}
                at={[0.51 + x, 1.66, -0.22 + z]}
                size={[0.14, 0.18, 0.14]}
                color={stone}
              />
            )),
          )}
          <Window at={[0.51, 1.18, 0.04]} />
        </group>
      )}
      <Block at={[-0.27, 0.06, 0.73]} size={[0.4, 0.12, 0.24]} color={stone} />
      <Crates at={[0.46, 0.15, 0.53]} />
    </group>
  );
}

function Guildhall({ bell, roofColor }: { bell: boolean; roofColor: string }) {
  return (
    <group>
      <Block at={[0, 0.25, 0]} size={[1.38, 0.13, 1.1]} color={timber} />
      {[-0.54, 0.54].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <Block
            key={`${x}-${z}`}
            at={[x, 0.14, z]}
            size={[0.1, 0.28, 0.1]}
            color={darkTimber}
          />
        )),
      )}
      <Block at={[0, 0.69, -0.1]} size={[1.03, 0.78, 0.83]} color="#cba783" />
      <Roof at={[0, 1.08, -0.1]} size={[1.3, 0.85, 1.12]} color={roofColor} />
      {[-0.46, 0.46].map((x) => (
        <Block
          key={x}
          at={[x, 0.69, 0.33]}
          size={[0.075, 0.78, 0.08]}
          color={darkTimber}
        />
      ))}
      <Block at={[0, 0.85, 0.34]} size={[1.03, 0.06, 0.08]} color={timber} />
      <Door at={[-0.15, 0.58, 0.34]} />
      <Window at={[0.28, 0.7, 0.34]} />
      <Block at={[0, 0.48, 0.53]} size={[1.2, 0.055, 0.05]} color={timber} />
      {[-0.52, 0.52].map((x) => (
        <Block
          key={x}
          at={[x, 0.39, 0.53]}
          size={[0.04, 0.25, 0.04]}
          color={darkTimber}
        />
      ))}
      <Block at={[-0.15, 0.12, 0.69]} size={[0.4, 0.12, 0.25]} color={timber} />
      <Block at={[-0.15, 0.22, 0.55]} size={[0.4, 0.1, 0.2]} color={timber} />
      {bell && (
        <group position={[0.35, 1.37, -0.29]}>
          <Block at={[0, 0.07, 0]} size={[0.3, 0.12, 0.3]} color={timber} />
          {[-0.12, 0.12].flatMap((x) =>
            [-0.12, 0.12].map((z) => (
              <Block
                key={`${x}-${z}`}
                at={[x, 0.25, z]}
                size={[0.035, 0.3, 0.035]}
                color={timber}
              />
            )),
          )}
          <mesh position={[0, 0.23, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.09, 0.13, 8]} />
            <meshStandardMaterial color="#b89b59" roughness={0.8} />
          </mesh>
          <Roof at={[0, 0.4, 0]} size={[0.44, 0.35, 0.42]} color={roofColor} />
        </group>
      )}
    </group>
  );
}

function Windmill({
  printing,
  tall,
  roofColor,
}: {
  printing: boolean;
  tall: boolean;
  roofColor: string;
}) {
  const lift = tall ? 0.5 : 0;
  return (
    <group>
      <mesh position={[-0.32, 0.67 + lift / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.48, 1.24 + lift, 12]} />
        <meshStandardMaterial color="#d8bd8e" roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.32, 1.45 + lift, 0]} castShadow>
        <coneGeometry args={[0.5, 0.48, 12]} />
        <meshStandardMaterial color={roofColor} roughness={1} flatShading />
      </mesh>
      <Door at={[-0.32, 0.3, 0.43]} />
      <Block at={[0.46, 0.3, -0.13]} size={[0.83, 0.5, 0.72]} color={stone} />
      {printing ? (
        [-0.05, 0.35, 0.75].map((x) => (
          <Roof
            key={x}
            at={[x, 0.55, -0.13]}
            size={[0.44, 0.5, 0.84]}
            color={roofColor}
          />
        ))
      ) : (
        <Roof
          at={[0.46, 0.55, -0.13]}
          size={[1.02, 0.5, 0.9]}
          color={roofColor}
        />
      )}
      <Window at={[0.27, 0.32, 0.25]} />
      <Window at={[0.63, 0.32, 0.25]} />
      <group
        position={[-0.32, 1.32 + lift, 0.45]}
        rotation={[0, 0, Math.PI / 4]}
      >
        {[0, 1, 2, 3].map((index) => (
          <group key={index} rotation={[0, 0, (index * Math.PI) / 2]}>
            <Block at={[0, 0.48, 0]} size={[0.045, 1, 0.055]} color={timber} />
            <Block
              at={[0.1, 0.62, 0]}
              size={[0.28, 0.57, 0.025]}
              color={cream}
            />
            {[0.38, 0.62, 0.86].map((y) => (
              <Block
                key={y}
                at={[0.1, y, 0.025]}
                size={[0.29, 0.025, 0.03]}
                color={timber}
              />
            ))}
          </group>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.12, 12]} />
          <meshStandardMaterial color={timber} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

function Treasury({ roofColor }: { roofColor: string }) {
  return (
    <group>
      <Block at={[0, 0.06, 0]} size={[1.56, 0.12, 1.43]} color={darkStone} />
      <Block at={[0, 0.44, 0]} size={[1.33, 0.72, 1.2]} color={stone} />
      <mesh
        geometry={arch}
        position={[0, 0.8, 0]}
        scale={[0.76, 0.6, 1.4]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={roofColor} roughness={1} flatShading />
      </mesh>
      {[-0.67, -0.33, 0, 0.33, 0.67].map((z) => (
        <mesh key={z} position={[0, 0.8, z]} scale={[0.76, 0.6, 1]} castShadow>
          <torusGeometry args={[1, 0.025, 4, 16, Math.PI]} />
          <meshStandardMaterial color="#a3abb0" roughness={1} />
        </mesh>
      ))}
      <mesh
        position={[0, 0.45, 0.63]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.31, 0.31, 0.07, 12]} />
        <meshStandardMaterial color="#858f94" roughness={1} />
      </mesh>
      <mesh position={[0, 0.45, 0.68]}>
        <torusGeometry args={[0.18, 0.02, 4, 12]} />
        <meshStandardMaterial color="#c7b784" roughness={1} />
      </mesh>
      <Block at={[0, 0.45, 0.69]} size={[0.38, 0.025, 0.025]} color="#c7b784" />
      <Block at={[0, 0.45, 0.69]} size={[0.025, 0.38, 0.025]} color="#c7b784" />
      <Crates at={[0.62, 0.12, 0.55]} />
    </group>
  );
}

function SignalTower({ roofColor }: { roofColor: string }) {
  return (
    <group>
      <Block at={[0.4, 0.33, 0.14]} size={[0.83, 0.59, 0.72]} color="#b27f64" />
      <Roof at={[0.4, 0.62, 0.14]} size={[1, 0.45, 0.9]} color={roofColor} />
      <Door at={[0.4, 0.25, 0.52]} />
      <group position={[-0.42, 0, -0.15]}>
        {[-0.3, 0.3].flatMap((x) =>
          [-0.3, 0.3].map((z) => (
            <group key={`${x}-${z}`}>
              <Block
                at={[x, 0.11, z]}
                size={[0.2, 0.22, 0.2]}
                color="#b58a6d"
              />
              <Block
                at={[x, 0.9, z]}
                size={[0.095, 1.7, 0.095]}
                color={timber}
              />
            </group>
          )),
        )}
        {[0.55, 1.12, 1.68].map((y) => (
          <group key={y}>
            <Block at={[0, y, 0]} size={[0.79, 0.075, 0.78]} color={timber} />
            <Block
              at={[0, y - 0.27, 0.3]}
              size={[0.065, 0.78, 0.065]}
              color={timber}
              rotation={[0, 0, 0.77]}
            />
            <Block
              at={[0.3, y - 0.27, 0]}
              size={[0.065, 0.78, 0.065]}
              color={timber}
              rotation={[0.77, 0, 0]}
            />
          </group>
        ))}
        <Roof at={[0, 1.78, 0]} size={[0.95, 0.4, 0.9]} color={roofColor} />
        <mesh position={[0, 2.13, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.16, 0.28, 8]} />
          <meshStandardMaterial color="#d8b76a" roughness={1} />
        </mesh>
        <mesh position={[0, 2.32, 0]} castShadow>
          <coneGeometry args={[0.19, 0.18, 8]} />
          <meshStandardMaterial color={timber} roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Canopy({ roofColor }: { roofColor: string }) {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.91, 0.91, 0.14, 12]} />
        <meshStandardMaterial color={timber} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <coneGeometry args={[1, 1.02, 8, 1, true]} />
        <meshStandardMaterial
          color={roofColor}
          roughness={1}
          side={2}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.97, 0.97, 0.16, 8, 1, true]} />
        <meshStandardMaterial
          color={cream}
          roughness={1}
          side={2}
          flatShading
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
        const angle = (index * Math.PI) / 4;
        return (
          <Block
            key={index}
            at={[Math.cos(angle) * 0.89, 0.48, Math.sin(angle) * 0.89]}
            size={[0.065, 0.82, 0.065]}
            color={timber}
          />
        );
      })}
      <Block at={[0, 1.58, 0]} size={[0.07, 0.2, 0.07]} color={timber} />
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.065, 12]} />
        <meshStandardMaterial color="#cba47b" roughness={1} />
      </mesh>
      <Block at={[0, 0.25, 0]} size={[0.08, 0.3, 0.08]} color={timber} />
    </group>
  );
}

function Harbor({ roofColor }: { roofColor: string }) {
  return (
    <group>
      <Block at={[0, 0.19, 0.34]} size={[1.7, 0.13, 1.55]} color="#ad8f69" />
      {[-0.7, -0.35, 0, 0.35, 0.7].map((x) => (
        <Block
          key={x}
          at={[x, 0.263, 0.34]}
          size={[0.015, 0.012, 1.55]}
          color={darkTimber}
        />
      ))}
      {[-0.7, 0.7].flatMap((x) =>
        [-0.3, 0.9].map((z) => (
          <Block
            key={`${x}-${z}`}
            at={[x, 0.15, z]}
            size={[0.1, 0.6, 0.1]}
            color={darkTimber}
          />
        )),
      )}
      <Block
        at={[0.21, 0.57, -0.09]}
        size={[0.94, 0.62, 0.77]}
        color="#ac8261"
      />
      <Roof
        at={[0.21, 0.88, -0.09]}
        size={[1.2, 0.65, 0.97]}
        color={roofColor}
      />
      <Door at={[0.21, 0.47, 0.315]} size={[0.36, 0.4, 0.035]} />
      <Crates at={[-0.57, 0.27, 0.47]} />
      <Crates at={[0.44, 0.27, 0.58]} />
    </group>
  );
}

function SortingHouse({ roofColor }: { roofColor: string }) {
  return (
    <group>
      <Block at={[-0.18, 0.06, 0]} size={[1.35, 0.12, 1.11]} color="#c4aa85" />
      <Block at={[-0.18, 0.45, 0]} size={[1.06, 0.7, 0.89]} color="#d9be94" />
      <Block
        at={[-0.18, 0.85, 0]}
        size={[1.25, 0.13, 1.06]}
        color={roofColor}
      />
      <Block
        at={[0.68, 0.61, 0.1]}
        size={[0.72, 0.07, 1.1]}
        color={roofColor}
      />
      <Block at={[0.96, 0.35, 0.52]} size={[0.06, 0.58, 0.06]} color={timber} />
      <Block
        at={[0.96, 0.35, -0.34]}
        size={[0.06, 0.58, 0.06]}
        color={timber}
      />
      <Door at={[-0.25, 0.32, 0.46]} />
      <Window at={[0.1, 0.58, 0.46]} />
      <Crates at={[0.5, 0.09, 0.36]} />
    </group>
  );
}
