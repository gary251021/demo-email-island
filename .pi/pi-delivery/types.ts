export type Phase =
  | "prepare"
  | "planning"
  | "building"
  | "verification"
  | "review"
  | "corrections"
  | "preview";
export type Status = "waiting" | "running" | "completed" | "blocked";
export type Axis = "standards" | "spec";
export interface DeliveryProfile {
  version: 1;
  implementer?: {
    model?: string;
    thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  };
  concurrency: number;
  maxReviewRounds: number;
  extensions?: string[];
  skills: Record<"coordinator" | "implementer" | Axis, string[]>;
}
export interface Report {
  status: Status;
  revision?: string;
  summary?: string;
  blocker?: string;
  evidence: string[];
}
export interface Preparation extends Report {
  pins?: {
    baseBranch: string;
    baseRevision: string;
    featureBase: string;
    featureBranch: string;
    integrationBranch?: string;
    integrationBase?: string;
    harnessRevision?: string;
    dependencies: { branch: string; revision: string }[];
  };
}
export interface Task {
  id: string;
  title: string;
  acceptance: string[];
  dependsOn: string[];
  ownedPaths?: string[];
  contract?: string;
}
export interface TestResult {
  command: string;
  outcome: "passed" | "failed" | "blocked" | "skipped";
  artifact?: string;
  revision?: string;
}
export interface Implementation extends Report {
  taskId: string;
  agentRunId?: string;
  tests: TestResult[];
}
export interface Check {
  name: string;
  kind: "automated" | "live" | "visual";
  outcome: TestResult["outcome"];
  command?: string;
  artifact?: string;
}
export interface Verification extends Report {
  checks: Check[];
  agentRunId?: string;
}
export interface Finding {
  id: string;
  severity: "T1" | "T2" | "T3";
  taskId: string;
  requirement: string;
  evidence: string;
  disposition: "unresolved" | "resolved";
}
export interface Review extends Report {
  axis: Axis;
  agentRunId?: string;
  verdict: "passed" | "changes_requested" | "blocked";
  round: number;
  findings: Finding[];
}
export interface Preview extends Report {
  artifact?: string;
  sourceBranch?: string;
  targetBranch?: string;
  reviewedRevision?: string;
  targetRevision?: string;
  patchEqual?: boolean;
  targetCompatible?: boolean;
}
/** Reports are evidence references, not execution or acceptance certificates. */
export interface RunState {
  schemaVersion: 1;
  issue: number;
  repo: string;
  revision: number;
  phase: Phase;
  head?: string;
  /** Workflow iterations are distinct from snapshot revisions and review rounds. */
  workflow?: {
    round: number;
    feedbackCycles: string[];
    correctionPending: boolean;
  };
  /** Absent in older snapshots: no delivery stop or confirmed publication. */
  stopped?: { blocker: string; evidence: string[] };
  publication?: { mrUrl: string; evidence: string[] };
  preparation?: Preparation;
  plan?: Report;
  tickets: Task[];
  implementations: Implementation[];
  verifications: Verification[];
  reviews: Review[];
  previews: Preview[];
  legacyEvidence: string[];
}
