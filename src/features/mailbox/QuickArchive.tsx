import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MailScope } from "../../lib/mailbox";
import { quickArchiveQueryOptions } from "./mailbox.queries";
import { useMailActions } from "./useMailActions";

export function QuickArchive({
  ownerKey,
  input,
  name,
  onUnauthenticated,
  children,
}: {
  ownerKey: string;
  input: MailScope;
  name: string;
  onUnauthenticated: () => void;
  children: React.ReactNode;
}) {
  const controls = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const preview = useQuery({
    ...quickArchiveQueryOptions(ownerKey, input),
    enabled: visible,
  });
  const mailIds = preview.data?.mailIds ?? [];
  const { snapshot } = useMailActions(ownerKey);
  const error = snapshot.error ?? preview.error;
  useEffect(() => {
    if (error?.message === "UNAUTHENTICATED") onUnauthenticated();
  }, [error, onUnauthenticated]);
  return (
    <div
      ref={controls}
      className="subcategory-controls"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement))
          setVisible(false);
      }}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setVisible(true);
      }}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          setVisible(false);
      }}
    >
      {children}
      {visible &&
        preview.isSuccess &&
        !preview.isFetching &&
        mailIds.length >= 1 &&
        mailIds.length <= 2 && (
          <button
            type="button"
            className="quick-archive"
            aria-label={`${name}：封存 ${mailIds.length} 封未讀`}
            disabled={snapshot.isPending}
            onClick={() =>
              snapshot.mutate(
                { ...input, mailIds },
                {
                  onError: () => {
                    controls.current
                      ?.querySelector<HTMLButtonElement>(".island-label")
                      ?.focus();
                    void preview.refetch();
                  },
                },
              )
            }
          >
            封存 {mailIds.length} 封未讀
          </button>
        )}
      {visible && error && (
        <p className="quick-archive-error" role="alert">
          {error.message === "SNAPSHOT_CHANGED"
            ? "郵件已變動，請確認後再按封存。"
            : "未能封存，請重試。"}
        </p>
      )}
    </div>
  );
}
