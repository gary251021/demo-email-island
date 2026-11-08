import { useHydrated } from "@tanstack/react-router";

type AccountNavProps = {
  action: "登入" | "登出";
  pending: boolean;
  error?: boolean;
  onAction: () => void;
};

export function AccountNav({
  action,
  pending,
  error,
  onAction,
}: AccountNavProps) {
  const interactive = useHydrated();
  return (
    <nav className="account-nav" aria-label="帳戶導覽">
      <button
        type="button"
        className="account-button"
        disabled={!interactive || pending}
        aria-busy={pending}
        aria-describedby={action === "登出" ? "logout-note" : undefined}
        onClick={onAction}
      >
        {action}
      </button>
      {action === "登出" && (
        <p id="logout-note" className="account-note">
          登出後將無法返回這座群島。
        </p>
      )}
      {pending && action === "登出" && (
        <p className="account-note" role="status">
          正在登出…
        </p>
      )}
      {error && (
        <div className="account-error" role="alert">
          <span>登出失敗，請重試。</span>
          <button
            type="button"
            className="text-button"
            disabled={pending}
            onClick={onAction}
          >
            重試
          </button>
        </div>
      )}
    </nav>
  );
}
