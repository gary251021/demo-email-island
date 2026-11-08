import {
  createFileRoute,
  redirect,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { getIdentity } from "../features/session/session.functions";
import { overviewQueryOptions } from "../features/mailbox/mailbox.queries";
import { IslandExperience } from "../features/island/IslandExperience";
import {
  islandSelectionSchema,
  resolveSelection,
} from "../features/island/navigation";

export const Route = createFileRoute("/island")({
  validateSearch: (search) => islandSelectionSchema.parse(search),
  loaderDeps: ({ search }) => search,
  beforeLoad: async () => {
    const identity = await getIdentity({ data: {} });
    if (!identity) throw redirect({ to: "/" });
    return { identity };
  },
  loader: async ({ context, deps }) => {
    const options = overviewQueryOptions(context.identity.ownerKey);
    try {
      const overview = await context.queryClient.query(options);
      resolveSelection(overview, deps);
      return { overview };
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        context.queryClient.clear();
        throw redirect({ to: "/" });
      }
      if (error instanceof TypeError) {
        const previous = context.queryClient.getQueryData(options.queryKey);
        if (previous !== undefined) {
          resolveSelection(previous, deps);
          return { overview: previous };
        }
      }
      throw error;
    }
  },
  pendingComponent: () => (
    <main className="island-experience">
      <p className="scene-message" role="status">
        正在展開群島…
      </p>
    </main>
  ),
  errorComponent: IslandError,
  component: IslandRoute,
});

function IslandRoute() {
  const { identity } = Route.useRouteContext();
  const { overview } = Route.useLoaderData();
  const selection = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <IslandExperience
      ownerKey={identity.ownerKey}
      overview={overview}
      selection={selection}
      onNavigate={(search) => void navigate({ search })}
    />
  );
}

function IslandError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const notFound =
    error instanceof Error &&
    (error.message === "NOT_FOUND" || error.name === "ZodError");
  return (
    <main className="island-experience">
      <section className="island-error" role="alert">
        <h1>{notFound ? "找不到這個位置" : "群島載入失敗"}</h1>
        <p>{notFound ? "請返回群島選擇郵件。" : "請重試以繼續閱讀。"}</p>
        {notFound ? (
          <a className="text-button" href="/island">
            返回群島
          </a>
        ) : (
          <button
            type="button"
            className="text-button"
            onClick={() => void router.invalidate()}
          >
            重試
          </button>
        )}
      </section>
    </main>
  );
}
