import { mailListQueryOptions } from "../mailbox/mailbox.queries";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backlogName } from "../../lib/backlog";
import type { Overview } from "../../lib/mailbox";
import { prepareBacklog, commitBacklog } from "./backlog.functions";
type Plan = Awaited<ReturnType<typeof prepareBacklog>>;
type Group = { groupId: string; name: string; mailIds: string[] };
export function useBacklogCard(
  ownerKey: string,
  category: Overview["domains"][number]["subcategories"][number],
  domain: Overview["domains"][number],
  onUnauthenticated: () => void,
) {
  const queryClient = useQueryClient();
  const scope = useQuery(
    mailListQueryOptions(ownerKey, {
      domainId: domain.id,
      subcategoryId: category.id,
      view: "active",
    }),
  );
  const draftKey = ["backlog-draft", ownerKey, category.id];
  const cached = queryClient.getQueryData<{
    plan: Plan | null;
    action: "split" | "archive" | null;
    groups: Group[];
    ids: string[];
  }>(draftKey);
  const [plan, setPlan] = useState<Plan | null>(cached?.plan ?? null);
  const [action, setAction] = useState<"split" | "archive" | null>(
    cached?.action ?? null,
  );
  const [groups, setGroups] = useState<Group[]>(cached?.groups ?? []);
  const [ids, setIds] = useState<string[]>(cached?.ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    queryClient.setQueryData(["backlog-draft", ownerKey, category.id], {
      plan,
      action,
      groups,
      ids,
    });
  }, [queryClient, ownerKey, category.id, plan, action, groups, ids]);
  async function preview(next: "split" | "archive") {
    setBusy(true);
    setError("");
    try {
      const result = await prepareBacklog({
        data: { subcategoryId: category.id, action: next },
      });
      setPlan(result);
      setAction(next);
      setGroups(
        result.groups.map((group) => {
          const previous = groups.find(
            (entry) => entry.groupId === group.groupId,
          );
          return {
            groupId: group.groupId,
            name: previous?.name ?? group.sender,
            mailIds: group.mailIds.filter((id) => {
              if (previous && plan?.mails.some((mail) => mail.id === id))
                return previous.mailIds.includes(id);
              return !result.mails.find((mail) => mail.id === id)?.manual;
            }),
          };
        }),
      );
      setIds(
        result.mails.filter((mail) => !mail.manual).map((mail) => mail.id),
      );
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }
  function fail(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message === "UNAUTHENTICATED") onUnauthenticated();
    else {
      const messages: Record<string, string> = {
        STALE_PLAN: "預覽已過時，請重新查看建議再確認。",
        NAME_CONFLICT: "名稱已存在，請修改名稱。",
      };
      setError(messages[message] ?? "未能保存，請重試。");
    }
  }
  async function refresh() {
    setBusy(true);
    try {
      await queryClient.invalidateQueries(
        { queryKey: ["mailbox", ownerKey], refetchType: "all" },
        { throwOnError: true },
      );
      await queryClient.invalidateQueries({
        queryKey: ["classification", ownerKey],
      });
      setFresh(true);
      setError("");
    } catch {
      setError("已保存，畫面尚未更新");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!plan || !action) return;
    setBusy(true);
    setError("");
    try {
      await commitBacklog({
        data: {
          planId: plan.planId,
          revision: plan.revision,
          selection:
            action === "archive"
              ? { action, mailIds: ids }
              : {
                  action,
                  groups: groups.filter((group) => group.mailIds.length > 0),
                },
        },
      });
      setSaved(true);
      queryClient.removeQueries({
        queryKey: ["backlog-draft", ownerKey, category.id],
        exact: true,
      });
      await refresh();
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }
  const selected = groups.filter((group) => group.mailIds.length > 0);
  const names = selected.map((group) => backlogName.safeParse(group.name));
  const invalid =
    names.some((name) => !name.success) ||
    new Set(names.filter((name) => name.success).map((name) => name.data))
      .size !== selected.length ||
    names.some(
      (name) =>
        name.success &&
        domain.subcategories.some((entry) => entry.name === name.data),
    );
  return {
    scope,
    plan,
    action,
    groups,
    setGroups,
    ids,
    setIds,
    busy,
    error,
    saved,
    fresh,
    preview,
    refresh,
    confirm,
    selected,
    invalid,
  };
}
