import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ListMailInput, MailInput, MailView } from "../../lib/mailbox";
import { mailListQueryOptions } from "./mailbox.queries";
import { MailActions } from "./MailActions";
import { useMailReader } from "./useMailReader";

type MailPanelProps = {
  ownerKey: string;
  input: ListMailInput;
  name: string;
  mailId?: string;
  onOpenMail: (mailId: string) => void;
  onBack: () => void;
  onView: (view: MailView) => void;
  onClose: () => void;
  onUnauthenticated: () => void;
};

export function MailPanel(props: MailPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  return (
    <section
      className="mail-panel"
      role="dialog"
      aria-label={`${props.name}郵件`}
      onKeyDown={(event) => {
        if (event.key === "Escape") props.onClose();
      }}
    >
      <header className="mail-panel-header">
        <div>
          <h1>{props.name}</h1>
          <div className="mail-view-tabs" role="group" aria-label="郵件檢視">
            <button
              type="button"
              aria-pressed={props.input.view === "active"}
              onClick={() => props.onView("active")}
            >
              郵件
            </button>
            <button
              type="button"
              aria-pressed={props.input.view === "archived"}
              onClick={() => props.onView("archived")}
            >
              已封存
            </button>
          </div>
        </div>
        <button
          ref={closeButton}
          type="button"
          className="icon-button"
          aria-label="關閉郵件"
          onClick={props.onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      {props.mailId ? (
        <MailBody
          key={props.mailId}
          ownerKey={props.ownerKey}
          input={{
            domainId: props.input.domainId,
            subcategoryId: props.input.subcategoryId,
            mailId: props.mailId,
          }}
          onBack={props.onBack}
          onUnauthenticated={props.onUnauthenticated}
        />
      ) : (
        <MailList
          ownerKey={props.ownerKey}
          input={props.input}
          onOpenMail={props.onOpenMail}
          onUnauthenticated={props.onUnauthenticated}
        />
      )}
    </section>
  );
}

function MailList({
  ownerKey,
  input,
  onOpenMail,
  onUnauthenticated,
}: Pick<
  MailPanelProps,
  "ownerKey" | "input" | "onOpenMail" | "onUnauthenticated"
>) {
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useQuery(mailListQueryOptions(ownerKey, input));
  useEffect(() => {
    heading.current?.focus();
  }, [list.isSuccess]);
  useUnauthenticated(list.error, onUnauthenticated);
  if (list.isPending)
    return (
      <p className="panel-message" role="status">
        正在載入郵件…
      </p>
    );
  if (list.isError)
    return <ReadError error={list.error} retry={() => void list.refetch()} />;

  return (
    <div>
      <h2 className="mail-list-title" ref={heading} tabIndex={-1}>
        {input.view === "archived" ? "已封存列表" : "郵件列表"}
      </h2>
      {list.data.length === 0 && (
        <p className="panel-message">這裡還沒有郵件。</p>
      )}
      <ul className="mail-list" aria-label="郵件列表">
        {list.data.map((mail) => (
          <li key={mail.id}>
            <button
              type="button"
              className="mail-row"
              onClick={() => onOpenMail(mail.id)}
            >
              <span className="mail-row-topline">
                <span className="mail-sender">{mail.sender}</span>
                <time dateTime={mail.receivedAt}>
                  {formatDate(mail.receivedAt)}
                </time>
              </span>
              <span className="mail-subject">{mail.subject}</span>
              {mail.readAt === null && (
                <span className="mail-unread">未讀</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type MailBodyProps = {
  ownerKey: string;
  input: MailInput;
  onBack: () => void;
  onUnauthenticated: () => void;
};

function MailBody({
  ownerKey,
  input,
  onBack,
  onUnauthenticated,
}: MailBodyProps) {
  const { detail, save } = useMailReader(ownerKey, input);
  useUnauthenticated(detail.error ?? save.error, onUnauthenticated);

  return (
    <div className="mail-reader">
      <button type="button" className="text-button" onClick={onBack}>
        <span aria-hidden="true">←</span> 返回列表
      </button>
      {detail.isPending && (
        <p className="panel-message" role="status">
          正在載入郵件…
        </p>
      )}
      {detail.isError && (
        <ReadError error={detail.error} retry={() => void detail.refetch()} />
      )}
      {detail.isSuccess && (
        <article aria-label={detail.data.subject}>
          <h2>{detail.data.subject}</h2>
          <div className="mail-envelope">
            <p>{detail.data.sender}</p>
            <time dateTime={detail.data.receivedAt}>
              {formatDate(detail.data.receivedAt)}
            </time>
          </div>
          <div className="mail-body-text">{detail.data.bodyText}</div>
          <MailActions
            ownerKey={ownerKey}
            input={input}
            mail={detail.data}
            onArchived={onBack}
            onUnauthenticated={onUnauthenticated}
          />

          <div className="read-receipt" aria-live="polite">
            {save.isPending && <p role="status">正在保存已讀狀態…</p>}
            {save.isError && (
              <div className="save-error" role="alert">
                <p>已讀狀態保存失敗，請重試。</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => save.mutate()}
                >
                  重試
                </button>
              </div>
            )}
            {(save.isSuccess || detail.data.readAt !== null) && <p>已讀</p>}
          </div>
        </article>
      )}
    </div>
  );
}

function useUnauthenticated(
  error: Error | null,
  onUnauthenticated: () => void,
) {
  useEffect(() => {
    if (error?.message === "UNAUTHENTICATED") onUnauthenticated();
  }, [error, onUnauthenticated]);
}

function ReadError({ error, retry }: { error: Error; retry: () => void }) {
  const missing = error.message === "NOT_FOUND";
  return (
    <div className="panel-message" role="alert">
      <p>{missing ? "找不到這封郵件或分類。" : "郵件載入失敗，請重試。"}</p>
      {!missing && (
        <button type="button" className="text-button" onClick={retry}>
          重試
        </button>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-Hant-HK", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(value));
}
