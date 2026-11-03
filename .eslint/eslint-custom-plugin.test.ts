import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import localReadabilityPlugin from "./eslint-custom-plugin.mjs";

const verify = (
  code: string,
  rule = "local/no-useless-alias-wrapper",
  options?: Record<string, number>,
) => {
  const linter = new Linter();

  return linter.verify(
    code,
    {
      files: ["**/*.tsx"],
      languageOptions: {
        ecmaVersion: 2022,
        parser: tsParser,
        sourceType: "module",
      },
      plugins: {
        local: localReadabilityPlugin,
      },
      rules: {
        [rule]: options ? ["warn", options] : "warn",
      },
    },
    { filename: "Component.tsx" },
  );
};

describe("local/no-useless-alias-wrapper", () => {
  it("reports functions that only forward the same arguments", () => {
    const messages = verify(`
      function formatSource(source?: PurchaseSource): string {
        return formatPurchaseSourceLabel(source);
      }
    `);

    expect(messages).toMatchObject([
      {
        messageId: "uselessAliasWrapper",
        ruleId: "local/no-useless-alias-wrapper",
        severity: 1,
      },
    ]);
  });

  it("allows wrappers that transform arguments", () => {
    const messages = verify(`
      function formatSource(source?: PurchaseSource): string {
        return formatPurchaseSourceLabel(source ?? "unknown");
      }
    `);

    expect(messages).toEqual([]);
  });
});

describe("local/responsibility-budget", () => {
  const rule = "local/responsibility-budget";

  it("reports a module with ten top-level functions once", () => {
    const functions = Array.from(
      { length: 10 },
      (_, index) => `const task${index} = () => ${index};`,
    ).join("\n");
    const messages = verify(functions, rule);

    expect(messages).toMatchObject([
      {
        messageId: "moduleOverBudget",
        ruleId: rule,
        severity: 1,
      },
    ]);
    expect(messages[0]?.message).toContain("10 module-level functions");
    expect(messages[0]?.message).toContain("target: at most 9");
  });

  it("allows nine top-level functions and ignores nested callbacks", () => {
    const functions = Array.from(
      { length: 9 },
      (_, index) => `function task${index}() { return ${index}; }`,
    ).join("\n");
    const messages = verify(
      `${functions}\nconst values = items.map((item) => item.value);`,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("reports ten executable class members and excludes the constructor", () => {
    const messages = verify(
      `
        class BusyService {
          constructor() {}
          first() {}
          second() {}
          third() {}
          fourth() {}
          fifth() {}
          #sixth() {}
          static seventh() {}
          get eighth() { return 8; }
          set ninth(value: number) {}
          tenth = () => 10;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "classOverBudget",
        ruleId: rule,
        severity: 1,
      },
    ]);
    expect(messages[0]?.message).toContain("BusyService");
    expect(messages[0]?.message).toContain("10 executable members");
  });

  it("does not count class overload signatures as executable members", () => {
    const methods = Array.from(
      { length: 8 },
      (_, index) => `task${index}() { return ${index}; }`,
    ).join("\n");
    const messages = verify(
      `
        class FocusedService {
          run(value: string): string;
          run(value: number): number;
          run(value: string | number) { return value; }
          ${methods}
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });
});

describe("local/component-module-contract", () => {
  const rule = "local/component-module-contract";

  it("allows one component and its props type", () => {
    const messages = verify(
      `
        export type MemberCardProps = {
          name: string;
        };
        export function MemberCard({ name }: MemberCardProps) {
          return <div>{name}</div>;
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("reports multiple runtime exports", () => {
    const messages = verify(
      `
        export const MEMBER_CARD_SIZE = 32;
        export function MemberCard() {
          return <div />;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "tooManyRuntimeExports",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("reports a named component and its default alias as two runtime exports", () => {
    const messages = verify(
      `
        export function MemberCard() {
          return <div />;
        }
        export default MemberCard;
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "tooManyRuntimeExports",
        message:
          "Component modules may export at most one runtime export. Found: MemberCard, default.",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("reports runtime star exports", () => {
    const messages = verify(`export * from "./MemberCard";`, rule);

    expect(messages).toMatchObject([
      {
        messageId: "runtimeStarExport",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("allows lowercase component factories that return a component", () => {
    const messages = verify(
      `
        export function createTable() {
          return function Table() {
            return <div />;
          };
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("reports lowercase functions that directly render JSX", () => {
    const messages = verify(
      `
        export function memberCard() {
          return <div />;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "invalidRuntimeExportName",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("does not classify lowercase non-JSX factories as components", () => {
    const messages = verify(
      `
        export function createFormatter() {
          return function format(value: string) {
            return value.trim();
          };
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });
});

describe("local/component-props-name", () => {
  const rule = "local/component-props-name";

  it("allows the component's conventional props type name", () => {
    const messages = verify(
      `
        export type MemberCardProps = { name: string };
        export function MemberCard({ name }: MemberCardProps) {
          return <div>{name}</div>;
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("reports a component props type that does not match the component name", () => {
    const messages = verify(
      `
        type CardProps = { name: string };
        export function MemberCard({ name }: CardProps) {
          return <div>{name}</div>;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "invalidPropsTypeName",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });
});

describe("local/component-props-type-exports", () => {
  const rule = "local/component-props-type-exports";

  it("allows a named type directly referenced by a private component props type", () => {
    const messages = verify(
      `
        export type MemberCardAdapter = {
          focus: () => void;
        };
        type MemberCardProps = {
          adapter: MemberCardAdapter;
        };
        export function MemberCard({ adapter }: MemberCardProps) {
          return <div>{adapter.focus()}</div>;
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("keeps types nested under an exported props member private", () => {
    const messages = verify(
      `
        export type MemberCardQueryParams = {
          page: number;
        };
        export type MemberCardAdapter = {
          query: (params: MemberCardQueryParams) => void;
        };
        export type MemberCardProps = {
          adapter: MemberCardAdapter;
        };
        export function MemberCard({ adapter }: MemberCardProps) {
          return <div>{adapter.query({ page: 1 })}</div>;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        message:
          "Type 'MemberCardQueryParams' is not part of 'MemberCardProps'. Export only the props type itself or a type directly referenced by it.",
        messageId: "unrelatedTypeExport",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("reports type star exports because their props relationship is unknown", () => {
    const messages = verify(
      `
        export type MemberCardProps = { name: string };
        export type * from "./member-card-types";
        export function MemberCard({ name }: MemberCardProps) {
          return <div>{name}</div>;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "typeStarExport",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });
});

describe("local/component-responsibility-budget", () => {
  const rule = "local/component-responsibility-budget";

  it("reports a component with five substantial local functions and nine Hooks", () => {
    const messages = verify(
      `
        export function BusyPanel() {
          const [first, setFirst] = useState(0);
          const [second, setSecond] = useState(0);
          const [third, setThird] = useState(0);
          const [fourth, setFourth] = useState(0);
          const cached = useMemo(() => first + second, [first, second]);
          const callback = useCallback(() => cached, [cached]);
          const reference = useRef(callback);
          const id = useId();
          const theme = useContext(ThemeContext);

          function updateFirst() {
            for (const value of values) {
              setFirst(value);
            }
          }

          function updateSecond() {
            for (const value of values) {
              setSecond(value);
            }
          }

          function updateThird() {
            for (const value of values) {
              setThird(value);
            }
          }

          function updateFourth() {
            for (const value of values) {
              setFourth(value);
            }
          }

          function synchronize() {
            for (const value of values) {
              sync(value);
            }
          }

          return <section id={id}>{theme.name}{reference.current}{callback()}</section>;
        }
      `,
      rule,
    );

    expect(messages).toMatchObject([
      {
        messageId: "overBudgetWithReact",
        ruleId: rule,
        severity: 1,
      },
    ]);
    expect(messages[0]?.message).toContain(
      "substantial local functions: 5, target at most 4",
    );
    expect(messages[0]?.message).toContain(
      "top-level Hooks: 9, target at most 8",
    );
  });

  it("allows a hard local signal without a supporting signal", () => {
    const messages = verify(
      `
        export function FocusedPanel() {
          function first() { for (const value of values) consume(value); }
          function second() { for (const value of values) consume(value); }
          function third() { for (const value of values) consume(value); }
          function fourth() { for (const value of values) consume(value); }
          function fifth() { for (const value of values) consume(value); }

          return <section>{first}{second}{third}{fourth}{fifth}</section>;
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("allows a supporting signal without a hard local signal", () => {
    const messages = verify(
      `
        export function HookedPanel() {
          const first = useMemo(() => 1, []);
          const second = useMemo(() => 2, []);
          const third = useMemo(() => 3, []);
          const fourth = useMemo(() => 4, []);
          const fifth = useMemo(() => 5, []);
          const sixth = useMemo(() => 6, []);
          const seventh = useMemo(() => 7, []);
          const eighth = useMemo(() => 8, []);
          const ninth = useMemo(() => 9, []);

          return <section>{first + second + third + fourth + fifth + sixth + seventh + eighth + ninth}</section>;
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });

  it("ignores JSX-only helpers and one-operation state setters", () => {
    const messages = verify(
      `
        export function RenderPanel() {
          const [open, setOpen] = useState(false);
          const renderHeader = () => <header>Header</header>;
          const renderBody = () => <main>Body</main>;
          const renderFooter = () => <footer>Footer</footer>;
          const openPanel = () => setOpen(true);
          const closePanel = () => setOpen(false);
          const togglePanel = () => setOpen((value) => !value);
          const resetPanel = () => setOpen(false);

          return (
            <section>
              {renderHeader()}
              {open && renderBody()}
              {renderFooter()}
            </section>
          );
        }
      `,
      rule,
      {
        maxLocalFunctions: 0,
        maxTopLevelHooks: 0,
      },
    );

    expect(messages).toEqual([]);
  });

  it("supports React namespace Hook calls and state writers", () => {
    const messages = verify(
      `
        export function NamespacedPanel() {
          const [value, setValue] = React.useState(0);
          const cached = React.useMemo(() => value, [value]);

          function synchronize() {
            for (const nextValue of values) {
              setValue(nextValue);
            }
          }

          return <section>{cached}{synchronize}</section>;
        }
      `,
      rule,
      {
        maxStateHooks: 0,
        maxTopLevelHooks: 1,
      },
    );

    expect(messages).toMatchObject([
      {
        messageId: "overBudgetWithReact",
        ruleId: rule,
        severity: 1,
      },
    ]);
  });

  it("allows a long linear JSX component without hard local overload", () => {
    const rows = Array.from(
      { length: 125 },
      (_, index) => `<span>Row ${index}</span>`,
    ).join("\n");
    const messages = verify(
      `
        export function LongPanel() {
          return (
            <section>
              ${rows}
            </section>
          );
        }
      `,
      rule,
    );

    expect(messages).toEqual([]);
  });
});
