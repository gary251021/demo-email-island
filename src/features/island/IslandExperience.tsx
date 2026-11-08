import { ClassificationStatus } from "../classifier/ClassificationStatus";
import { CategoryEditor } from "../classifier/CategoryEditor";
import { useCallback, useEffect, useRef } from "react";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Overview } from "../../lib/mailbox";
import { authClient } from "../session/auth-client";
import { AccountNav } from "../session/AccountNav";
import { overviewQueryOptions } from "../mailbox/mailbox.queries";
import { MailPanel } from "../mailbox/MailPanel";
import { IslandScene } from "./IslandScene";
import {
  closeMailPanel,
  resolveSelection,
  returnToList,
  type IslandSelection,
} from "./navigation";

type IslandExperienceProps = {
  ownerKey: string;
  overview: Overview;
  selection: IslandSelection;
  onNavigate: (selection: IslandSelection) => void;
};

export function IslandExperience({
  ownerKey,
  overview,
  selection,
  onNavigate,
}: IslandExperienceProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const query = useQuery({
    ...overviewQueryOptions(ownerKey),
    initialData: overview,
  });
  const { domain, subcategory } = resolveSelection(query.data, selection);
  const previousSubcategory = useRef<string | undefined>(undefined);
  const leave = useCallback(() => {
    queryClient.clear();
    void navigate({ to: "/", replace: true });
  }, [queryClient, navigate]);
  const logout = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: leave,
  });
  useEffect(() => {
    if (
      !session.isPending &&
      !session.error &&
      (!session.data || session.data.user.id !== ownerKey)
    )
      leave();
  }, [session.isPending, session.error, session.data, ownerKey, leave]);
  useEffect(() => {
    if (query.error?.message === "UNAUTHENTICATED") leave();
  }, [query.error, leave]);
  useEffect(() => {
    if (
      !selection.subcategory &&
      previousSubcategory.current &&
      document.activeElement === document.body
    )
      document
        .getElementById(`subcategory-${previousSubcategory.current}`)
        ?.focus();
    previousSubcategory.current = selection.subcategory;
  }, [selection.subcategory]);
  return (
    <main
      className={
        subcategory ? "island-experience has-mail-panel" : "island-experience"
      }
      aria-label={domain ? `${domain.name}板塊` : "郵件群島"}
    >
      <ClassificationStatus ownerKey={ownerKey} />
      <AccountNav
        action="登出"
        pending={logout.isPending}
        error={logout.isError}
        onAction={() => logout.mutate()}
      />
      <ClientOnly
        fallback={
          <p className="scene-message" role="status">
            正在展開群島…
          </p>
        }
      >
        <IslandScene
          domains={query.data.domains}
          domain={domain}
          selectedSubcategory={selection.subcategory}
          panelOpen={Boolean(subcategory)}
          onDomain={(domainId) => onNavigate({ domain: domainId })}
          onSubcategory={(subcategoryId) =>
            onNavigate({ domain: domain?.id, subcategory: subcategoryId })
          }
        />
      </ClientOnly>
      {domain && (
        <button
          type="button"
          className="island-back island-label"
          onClick={() => onNavigate({})}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m11 5-7 7 7 7M4 12h16" />
          </svg>
          返回群島
        </button>
      )}
      {query.isError && query.error.message !== "UNAUTHENTICATED" && (
        <div className="island-error" role="alert">
          <p>未能更新群島，請重試。</p>
          <button
            type="button"
            className="text-button"
            onClick={() => void query.refetch()}
          >
            重試
          </button>
        </div>
      )}
      {session.error && (
        <p className="session-error" role="status">
          身分暫時無法確認，請稍後再試。
        </p>
      )}
      {domain && subcategory && (
        <MailPanel
          renderCategoryEditor={(mailId) => (
            <CategoryEditor
              ownerKey={ownerKey}
              mailId={mailId}
              currentCategory={subcategory.id}
              overview={query.data}
              onSaved={(domainId, subcategoryId) =>
                onNavigate({
                  domain: domainId,
                  subcategory: subcategoryId,
                  mail: mailId,
                })
              }
            />
          )}
          ownerKey={ownerKey}
          name={subcategory.name}
          input={{ domainId: domain.id, subcategoryId: subcategory.id }}
          mailId={selection.mail}
          onOpenMail={(mailId) => onNavigate({ ...selection, mail: mailId })}
          onBack={() => onNavigate(returnToList(selection))}
          onClose={() => onNavigate(closeMailPanel(selection))}
          onUnauthenticated={leave}
        />
      )}
    </main>
  );
}
