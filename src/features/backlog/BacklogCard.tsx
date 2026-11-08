import { useEffect, useRef } from "react";
import { useBacklogCard } from "./useBacklogCard";
import type { Overview } from "../../lib/mailbox";
export function BacklogCard({
  ownerKey,
  category,
  domain,
  onClose,
  onUnauthenticated,
}: {
  ownerKey: string;
  category: Overview["domains"][number]["subcategories"][number];
  domain: Overview["domains"][number];
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  const {
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
  } = useBacklogCard(ownerKey, category, domain, onUnauthenticated);
  function toggleMail(groupId: string, mailId: string, checked: boolean) {
    setGroups(
      groups.map((group) => {
        if (group.groupId !== groupId) return group;
        const mailIds = checked
          ? [...group.mailIds, mailId]
          : group.mailIds.filter((id) => id !== mailId);
        return { ...group, mailIds };
      }),
    );
  }

  let countText = "正在讀取郵件數量…";
  if (plan) countText = `共 ${plan.totalCount} 封，未讀 ${plan.unreadCount} 封`;
  else if (scope.data)
    countText = `共 ${scope.data.mails.length} 封，未讀 ${scope.data.unreadCount} 封`;
  return (
    <section
      className="mail-panel backlog-card"
      role="dialog"
      aria-label={`${category.name}積壓處理`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="mail-panel-header">
        <div>
          <h2>{category.name}</h2>
          <p>積壓處理</p>
        </div>
        <button
          ref={close}
          type="button"
          className="icon-button"
          aria-label="關閉積壓處理"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="backlog-content">
        {saved ? (
          <>
            <p role="status">
              {fresh ? "已保存，群島已更新。" : "已保存，畫面尚未更新"}
            </p>
            {!fresh && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void refresh()}
              >
                更新重試
              </button>
            )}
          </>
        ) : (
          <>
            <p>{countText}</p>
            {scope.isError && (
              <p role="alert">
                未能讀取郵件數量。
                <button onClick={() => void scope.refetch()}>重試讀取</button>
              </p>
            )}
            <div className="backlog-actions">
              <button disabled={busy} onClick={() => void preview("archive")}>
                批次封存
              </button>
              <button disabled={busy} onClick={() => void preview("split")}>
                查看分拆建議
              </button>
            </div>
            {busy && <p role="status">正在處理…</p>}
            {plan && action === "split" && (
              <>
                {groups.length === 0 ? (
                  <p role="status">沒有分拆建議</p>
                ) : (
                  groups.map((group, index) => (
                    <fieldset key={group.groupId}>
                      <legend>{plan.groups[index]?.sender}</legend>
                      <label>
                        子島名稱
                        <input
                          aria-label={`子島名稱 ${index + 1}`}
                          value={group.name}
                          maxLength={100}
                          onChange={(event) =>
                            setGroups(
                              groups.map((entry) =>
                                entry.groupId === group.groupId
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`選取整組 ${group.name}`}
                          checked={
                            group.mailIds.length ===
                            plan.groups[index]?.mailIds.length
                          }
                          onChange={(event) =>
                            setGroups(
                              groups.map((entry) =>
                                entry.groupId === group.groupId
                                  ? {
                                      ...entry,
                                      mailIds: event.target.checked
                                        ? plan.groups[index]!.mailIds
                                        : [],
                                    }
                                  : entry,
                              ),
                            )
                          }
                        />
                        選取整組
                      </label>
                      {group.mailIds.length > 0 && (
                        <button
                          type="button"
                          aria-label={`取消整組 ${group.name}`}
                          onClick={() =>
                            setGroups(
                              groups.map((entry) =>
                                entry.groupId === group.groupId
                                  ? { ...entry, mailIds: [] }
                                  : entry,
                              ),
                            )
                          }
                        >
                          取消整組
                        </button>
                      )}
                      <details>
                        <summary>
                          檢視郵件 {plan.groups[index]?.mailIds.length} 封，已選{" "}
                          {group.mailIds.length} 封
                        </summary>
                        {plan.mails
                          .filter((mail) =>
                            plan.groups[index]?.mailIds.includes(mail.id),
                          )
                          .map((mail) => (
                            <label className="backlog-mail" key={mail.id}>
                              <input
                                type="checkbox"
                                checked={group.mailIds.includes(mail.id)}
                                onChange={(event) =>
                                  toggleMail(
                                    group.groupId,
                                    mail.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>
                                {mail.subject}
                                <small>
                                  {mail.readAt ? "已讀" : "未讀"}
                                  {mail.manual ? " · 人工分類" : ""}
                                </small>
                              </span>
                            </label>
                          ))}
                      </details>
                    </fieldset>
                  ))
                )}
                {invalid && (
                  <p role="alert">名稱須為 1 至 80 字元，且同領域不可重名。</p>
                )}
                {groups.length > 0 && (
                  <button
                    disabled={busy || invalid || selected.length === 0}
                    onClick={() => void confirm()}
                  >
                    確認分拆
                  </button>
                )}
              </>
            )}
            {plan && action === "archive" && (
              <>
                <div>
                  {plan.mails.map((mail) => (
                    <label className="backlog-mail" key={mail.id}>
                      <input
                        type="checkbox"
                        checked={ids.includes(mail.id)}
                        onChange={(event) =>
                          setIds(
                            event.target.checked
                              ? [...ids, mail.id]
                              : ids.filter((id) => id !== mail.id),
                          )
                        }
                      />
                      <span>
                        {mail.subject}
                        <small>
                          {mail.readAt ? "已讀" : "未讀"}
                          {mail.manual ? " · 人工分類" : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  disabled={busy || ids.length === 0}
                  onClick={() => void confirm()}
                >
                  確認封存 {ids.length} 封
                </button>
              </>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
