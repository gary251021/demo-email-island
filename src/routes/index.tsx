import { createFileRoute, redirect } from "@tanstack/react-router";
import DemoEntry from "../features/mailbox/DemoEntry";
import { getIdentity } from "../features/session/session.functions";
import { getOverview } from "../features/mailbox/mailbox.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const identity = await getIdentity({ data: {} });
    if (!identity) return;
    try {
      await getOverview({ data: {} });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") return;
      throw error;
    }
    throw redirect({ to: "/island" });
  },
  component: DemoEntry,
});
