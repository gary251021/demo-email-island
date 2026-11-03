import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  validateCheckout,
  commit,
  requireCondition,
  linearCommits,
  runCli,
} from "../scripts/shared.mjs";

export { validateCheckout };

export function validateReturn(input) {
  const { head, branch } = validateCheckout(input);
  const repo = input.repo ?? process.cwd();
  const base = commit(repo, input.start);
  return { head, branch, base, commits: linearCommits(repo, base, head) };
}

export function validateAcceptance({ acceptance }) {
  const nonempty = (value) =>
    typeof value === "string" && Boolean(value.trim());
  requireCondition(
    acceptance &&
      nonempty(acceptance.owner) &&
      Array.isArray(acceptance.criteria) &&
      acceptance.criteria.length > 0,
    "ACCEPTANCE_REQUIRED",
    "Supply context.acceptance with the ticket test owner and assigned criteria/scenarios before dispatch.",
  );
  const ids = new Set();
  for (const criterion of acceptance.criteria) {
    requireCondition(
      criterion && nonempty(criterion.id) && !ids.has(criterion.id),
      "ACCEPTANCE_REQUIRED",
      "Each assigned criterion needs a unique ID.",
    );
    ids.add(criterion.id);
    requireCondition(
      Array.isArray(criterion.scenarios) && criterion.scenarios.length > 0,
      "ACCEPTANCE_REQUIRED",
      `${criterion.id}: define acceptance scenarios before dispatch.`,
    );
    for (const scenario of criterion.scenarios) {
      requireCondition(
        scenario &&
          ["name", "inputs", "actions", "expected", "mockBoundary"].every(
            (key) => nonempty(scenario[key]),
          ),
        "ACCEPTANCE_REQUIRED",
        `${criterion.id}: each scenario needs name, inputs, actions, expected outcome and mockBoundary.`,
      );
    }
  }
  return { owner: acceptance.owner, criteria: [...ids] };
}

export function buildDispatch(input) {
  const {
    repo,
    expectedHead,
    branch,
    contextFile,
    assignment,
    metadata,
    title,
    model,
    thinking,
    projectId,
    threadId,
    hostId,
  } = input;
  requireCondition(
    typeof repo === "string" &&
      isAbsolute(repo) &&
      typeof contextFile === "string" &&
      isAbsolute(contextFile),
    "INVALID_INPUT",
    "repo and contextFile must be absolute paths.",
  );
  requireCondition(
    [assignment, metadata, title, model, thinking].every(
      (v) => typeof v === "string" && v.trim(),
    ),
    "INVALID_INPUT",
    "assignment, metadata, title, model and thinking are required.",
  );
  requireCondition(
    Boolean(threadId) !== Boolean(projectId),
    "INVALID_INPUT",
    "Supply projectId for a new preload chat or threadId for an existing worker, exclusively.",
  );
  requireCondition(
    !/^(Dispatch input|Ticket checkout|Ticket start SHA|Correction start SHA|Harness SHA):/m.test(
      metadata,
    ),
    "INVALID_INPUT",
    "Generated execution fields must not be supplied in metadata.",
  );
  const ticket = /^Internal ticket: [0-9]+\/[0-9]+$/m.test(metadata);
  const correction = /^Review correction: [1-9][0-9]*$/m.test(metadata);
  const preload = /^Worker preload: core$/m.test(metadata);
  requireCondition(
    [ticket, correction, preload].filter(Boolean).length === 1,
    "INVALID_ROLE",
    "Choose exactly one preload, ticket or correction role.",
  );
  requireCondition(
    preload || Boolean(threadId),
    "PRELOAD_REQUIRED",
    "Preload a worker first, then send its ticket or correction to that threadId.",
  );
  const { head } = validateCheckout({ repo, expectedHead, branch });
  const context = JSON.parse(readFileSync(contextFile, "utf8"));
  if (ticket) {
    validateAcceptance({ acceptance: context.acceptance });
  }
  const fields = preload
    ? ["guidance"]
    : [
        "issueContract",
        "acceptedComments",
        "guidance",
        "decisions",
        "codeMap",
        "verification",
      ];
  requireCondition(
    fields.every((k) => typeof context[k] === "string" && context[k].trim()),
    "MISSING_CONTEXT",
    `Context packet must supply: ${fields.join(", ")}.`,
  );
  const packet =
    fields.map((k) => `## ${k}\n${context[k]}`).join("\n\n") +
    (ticket
      ? `\n\n## acceptancePlan\n${JSON.stringify(context.acceptance, null, 2)}`
      : "");
  const instruction = preload
    ? "Read only the core guidance listed below in the assigned checkout. Do not implement, discover business code, delegate or start a server. Return READY with the paths read, then end the turn and remain idle until the coordinator sends a ticket. Do not sleep or poll."
    : "Reuse the core guidance already loaded in this chat; read only changed guidance or task-specific gaps. At ticket entry use phase 03 validateCheckout, not validateTicket. Follow the assigned test-authoring or feature-implementation role. Test workers write acceptance tests and record meaningful red against the pinned pre-implementation baseline in their isolated checkout. Implementers start feature work against the supplied contract concurrently, without waiting for test code or red evidence, and run the tests as they become available. Follow acceptance testing: preserve the agreed expectations, record baseline red and integrated green separately, and distinguish setup failures from behavioral red. For corrections, preserve the agreed acceptance expectations and add regression coverage as appropriate.";
  const prompt = `${title}\n${metadata}\nTicket checkout: ${repo}\n${correction ? "Correction" : "Ticket"} start SHA: ${head}\nDispatch input: ${JSON.stringify(input)}\n\nRun every command in the assigned checkout. You share the codebase; preserve others' edits. Execute only the assigned worker role in project-deliver-issue. Reuse the supplied context; report specific gaps instead of repeating broad discovery.\n\n${instruction}\n\n${assignment}\n\n${packet}`;
  return threadId
    ? {
        tool: "send_message_to_thread",
        arguments: {
          threadId,
          ...(hostId ? { hostId } : {}),
          model,
          thinking,
          prompt,
        },
      }
    : {
        tool: "create_thread",
        arguments: {
          model,
          thinking,
          title,
          prompt,
          target: {
            type: "project",
            projectId,
            environment: { type: "local" },
          },
        },
      };
}

runCli(import.meta.url, {
  validateCheckout,
  validateReturn,
  validateAcceptance,
  buildDispatch,
});
