import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Email Island" },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    }),
    shellComponent: RootShell,
  },
);

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant-HK">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
