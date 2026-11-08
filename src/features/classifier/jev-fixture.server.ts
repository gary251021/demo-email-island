// Isolated acceptance provider. This module is never imported by the application.
import { createServer } from "node:http";
import { zstdDecompressSync, gunzipSync } from "node:zlib";
import { z } from "zod";

const requestSchema = z.object({
  state: z.object({ subject: z.string() }),
  questions: z.object({
    category: z.object({ criteria: z.record(z.string(), z.unknown()) }),
  }),
});
const planSchema = z.object({
  subject: z.string(),
  step: z.enum(["domain", "subcategory"]).optional(),
  choice: z.string().optional(),
  fail: z.boolean().optional(),
  hold: z.boolean().optional(),
  confidence: z.number().optional(),
  invalid: z.boolean().optional(),
});
type Plan = z.infer<typeof planSchema>;
const plans: Plan[] = [];
const calls: {
  subject: string;
  step: string;
  requestId: number;
  body: unknown;
}[] = [];
let held: {
  subject: string;
  step: string;
  requestId: number;
  resolve: () => void;
}[] = [];
const subjectDomains: [RegExp, string][] = [
  [/報價|設計/, "core-projects"],
  [/團隊/, "internal-team"],
  [/文章|訂閱/, "newsletters"],
  [/帳單/, "finance-bills"],
  [/服務健康/, "system-alerts"],
  [/野餐/, "social-events"],
  [/包裹|配送/, "shopping-delivery"],
];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  let bytes = Buffer.concat(chunks);
  if (req.headers["content-encoding"] === "zstd")
    bytes = zstdDecompressSync(bytes);
  if (req.headers["content-encoding"] === "gzip") bytes = gunzipSync(bytes);
  const body = bytes.length ? JSON.parse(bytes.toString()) : {};
  const send = (status: number, value: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (req.url === "/control" && req.method === "POST") {
    plans.push(...planSchema.array().parse(body));
    send(200, {});
    return;
  }
  if (req.url === "/release-one" && req.method === "POST") {
    const selection = z
      .object({
        subject: z.string(),
        step: z.string().optional(),
        requestId: z.number().optional(),
      })
      .parse(body);
    const index = held.findIndex(
      (request) =>
        request.subject === selection.subject &&
        (!selection.step || request.step === selection.step) &&
        (selection.requestId === undefined ||
          selection.requestId === request.requestId),
    );
    if (index < 0) {
      send(404, { error: "NO_HELD_REQUEST" });
      return;
    }
    held.splice(index, 1)[0]!.resolve();
    send(200, {});
    return;
  }
  if (req.url === "/held") {
    send(
      200,
      held.map(({ subject, step, requestId }) => ({
        subject,
        step,
        requestId,
      })),
    );
    return;
  }
  if (req.url === "/release") {
    for (const plan of plans) plan.hold = false;
    const release = held;
    held = [];
    release.forEach((request) => request.resolve());
    send(200, {});
    return;
  }
  if (req.url === "/calls") {
    send(200, calls);
    return;
  }
  if (req.url === "/reset") {
    plans.length = 0;
    calls.length = 0;
    send(200, {});
    return;
  }
  if (req.url !== "/v1/systemone") {
    send(404, {});
    return;
  }
  try {
    const parsed = requestSchema.parse(body);
    const choices = Object.entries(parsed.questions.category.criteria);
    const step = choices.some(([id]) => id === "core-projects")
      ? "domain"
      : "subcategory";
    const subject = parsed.state.subject;
    const requestId = calls.length + 1;
    calls.push({ subject, step, requestId, body });
    const index = plans.findIndex(
      (plan) => subject === plan.subject && (!plan.step || plan.step === step),
    );
    const plan = index >= 0 ? plans.splice(index, 1)[0] : undefined;
    if (plan?.hold)
      await new Promise<void>((resolve) =>
        held.push({ subject, step, requestId, resolve }),
      );
    if (plan?.fail) {
      send(400, { error: { message: "Fixture classification failure" } });
      return;
    }
    let selected = plan?.choice;
    if (!selected && step === "domain")
      selected =
        subjectDomains.find(([pattern]) => pattern.test(subject))?.[1] ??
        "low-priority";
    if (!selected && step === "subcategory")
      selected = choices.find(([, description]) =>
        criterionName(description).includes(subcategoryName(subject)),
      )?.[0];
    const id =
      choices.find(
        ([id, description]) =>
          id === selected ||
          criterionName(description).includes(selected ?? "__none__"),
      )?.[0] ?? choices[0]?.[0];
    send(200, {
      model: "jev-1.14.0",
      answers: {
        category: {
          type: "choice",
          choice: plan?.invalid ? "not-a-candidate" : id,
          confidence: plan?.confidence ?? 0.93,
          probabilities: Object.fromEntries(
            choices.map(([key]) => [
              key,
              key === id ? 0.93 : 0.07 / Math.max(1, choices.length - 1),
            ]),
          ),
        },
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  } catch {
    send(400, { error: { message: "Invalid fixture request" } });
  }
});
server.listen(
  Number(process.env.EMAIL_ISLAND_JEV_FIXTURE_PORT ?? 4302),
  "127.0.0.1",
  () => console.log("Jev fixture ready"),
);
process.on("SIGTERM", () => {
  held.forEach((request) => request.resolve());
  server.close();
});

function subcategoryName(subject: string) {
  if (subject.includes("設計")) return "設計審批";
  if (subject.includes("報價")) return "Q4 報價";
  return "";
}

function criterionName(value: unknown) {
  if (typeof value === "string") return value; // The prior SDK fixture contract used plain option text.
  return z
    .object({ name: z.string(), description: z.string().nullable() })
    .parse(value).name;
}
