import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  // Module augmentation requires an interface for declaration merging.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
