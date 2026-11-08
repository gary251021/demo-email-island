import { useEffect, useRef, useState } from "react";
import type { MailDetail, MailInput } from "../../lib/mailbox";
import { replyBodySchema } from "../../lib/mailbox";
import { useMailActions } from "./useMailActions";

export function MailActions({
  ownerKey,
  input,
  mail,
  onArchived,
  onUnauthenticated,
}: {
  ownerKey: string;
  input: MailInput;
  mail: MailDetail;
  onArchived: () => void;
  onUnauthenticated: () => void;
}) {
  const { reply, archive } = useMailActions(ownerKey);
  const [bodyText, setBodyText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const attempt = useRef<{ replyId: string; bodyText: string } | null>(null);
  const error = reply.error ?? archive.error;
  useEffect(() => {
    if (error?.message === "UNAUTHENTICATED") onUnauthenticated();
  }, [error, onUnauthenticated]);
  return (
    <section className="mail-actions" aria-label="回覆與封存">
      <p className="pending-reply">
        {mail.hasPendingReply ? "待回覆" : "無待回覆"}
        {mail.archivedAt !== null ? " · 已封存" : ""}
      </p>
      {mail.replies.length > 0 && (
        <section className="reply-history" aria-label="回覆紀錄">
          <h3>回覆紀錄</h3>
          <ol>
            {mail.replies.map((item) => (
              <li key={item.id}>
                <p>{item.bodyText}</p>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString("zh-Hant-HK")}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!replyBodySchema.safeParse(bodyText).success) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          if (!attempt.current || attempt.current.bodyText !== bodyText)
            attempt.current = { replyId: crypto.randomUUID(), bodyText };
          reply.mutate(
            { ...input, ...attempt.current },
            {
              onSuccess: () => {
                setBodyText("");
                attempt.current = null;
              },
            },
          );
        }}
      >
        <label htmlFor={`reply-${mail.id}`}>回覆內容</label>
        <textarea
          id={`reply-${mail.id}`}
          value={bodyText}
          disabled={reply.isPending}
          aria-invalid={invalid}
          aria-describedby={invalid ? `reply-error-${mail.id}` : undefined}
          onChange={(event) => {
            setBodyText(event.target.value);
            setInvalid(false);
          }}
          rows={4}
        />
        {invalid && (
          <p role="alert" id={`reply-error-${mail.id}`}>
            請輸入 1 至 10,000 字元的回覆，不能只有空白。
          </p>
        )}
        <div className="mail-action-buttons">
          <button
            type="submit"
            className="reply-button"
            disabled={reply.isPending || archive.isPending}
          >
            回覆
          </button>
          {mail.archivedAt === null && (
            <button
              type="button"
              className="text-button"
              disabled={reply.isPending || archive.isPending}
              onClick={() => archive.mutate(input, { onSuccess: onArchived })}
            >
              封存
            </button>
          )}
        </div>
      </form>
      {reply.isPending && <p role="status">正在保存回覆…</p>}
      {reply.isSuccess && <p role="status">回覆已保存。</p>}
      {reply.isError && <p role="alert">回覆保存失敗，請再次按回覆重試。</p>}
      {archive.isError && <p role="alert">封存失敗，請再次按封存重試。</p>}
    </section>
  );
}
