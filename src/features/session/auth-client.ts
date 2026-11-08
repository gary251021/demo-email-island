import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [anonymousClient()],
  fetchOptions: {
    onRequest(context) {
      // Start supplies an empty request stream for this SDK's bodyless refresh.
      // Better Call requires valid JSON when a POST request has a body stream.
      if (
        context.method === "POST" &&
        context.url.toString().endsWith("/api/auth/get-session") &&
        context.body === null
      ) {
        context.headers.set("Content-Type", "application/json");
        context.body = "{}";
      }
      return context;
    },
  },
});
