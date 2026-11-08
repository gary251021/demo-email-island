import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { answerSchema } from "../../lib/classification";

// SDK owns transport retries. Provider state contains content, never fixture answers.
export async function askJev(
  state: {
    sender: string;
    subject: string;
    bodyText: string;
    receivedAt: string;
  },
  candidates: { id: string; name: string; description: string }[],
  model: string,
  step: "domain" | "subcategory",
) {
  if (!candidates.length) throw new Error("EMPTY_CANDIDATES");
  const client = new TypeSafeClient({
    apiKey: process.env.JEV_API_KEY,
    timeout: 30_000,
  });
  const criteria = Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      `${candidate.name}: ${candidate.description}`,
    ]),
  );
  const response = await client.systemOne({
    model,
    state,
    questions: {
      category: choice(
        step === "domain"
          ? "Choose the email domain."
          : "Choose the existing email subcategory.",
        criteria,
      ),
    },
  });
  const answer = answerSchema.parse(response.answers.category);
  const ids = candidates
    .map((candidate) => candidate.id)
    .sort((a, b) => a.localeCompare(b));
  if (
    !ids.includes(answer.choice) ||
    JSON.stringify(
      Object.keys(answer.probabilities).sort((a, b) => a.localeCompare(b)),
    ) !== JSON.stringify(ids)
  )
    throw new Error("INVALID_CHOICE");
  if (!response.model) throw new Error("MISSING_RESOLVED_MODEL");
  return { answer, resolvedModel: response.model };
}
