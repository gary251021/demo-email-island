import { useEffect, useState } from "react";
import type { MailScope } from "../../lib/mailbox";
import { getQuickArchivePreview } from "./mailbox.functions";
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
  const [mailIds, setMailIds] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [visible, setVisible] = useState(false);
  const { snapshot } = useMailActions(ownerKey);
  const error = snapshot.error ?? previewError;
  useEffect(() => {
    if (error?.message === "UNAUTHENTICATED") onUnauthenticated();
  }, [error, onUnauthenticated]);
  async function preview() {
    setVisible(true);
    try {
      const result = await getQuickArchivePreview({ data: input });
      setMailIds(result.mailIds);
      setPreviewError(null);
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
  return (
    <div
      className="subcategory-controls"
      onMouseEnter={() => void preview()}
      onMouseLeave={() => setVisible(false)}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void preview();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setVisible(false);
      }}
    >
      {children}
      {visible && mailIds.length >= 1 && mailIds.length <= 2 && (
        <button
          type="button"
          className="quick-archive"
          aria-label={`${name}：封存 ${mailIds.length} 封未讀`}
          disabled={snapshot.isPending}
          onClick={() =>
            snapshot.mutate(
              { ...input, mailIds },
              { onError: () => void preview() },
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
