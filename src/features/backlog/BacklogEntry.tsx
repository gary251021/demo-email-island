import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Overview } from "../../lib/mailbox";
import type { PromptInput } from "../../lib/backlog";
import { getBacklogPrompt, dismissBacklogPrompt } from "./backlog.functions";
export function BacklogEntry({
  ownerKey,
  domain,
  category,
  onOpen,
  onDomain,
}: {
  ownerKey: string;
  domain: Overview["domains"][number];
  category?: Overview["domains"][number]["subcategories"][number];
  onOpen: () => void;
  onDomain: () => void;
}) {
  const client = useQueryClient();
  const input: PromptInput = {
    scope: category ? { subcategoryId: category.id } : { domainId: domain.id },
  };
  const key = ["backlog", ownerKey, input];
  const prompt = useQuery({
    queryKey: key,
    queryFn: () => getBacklogPrompt({ data: input }),
    retry: false,
  });
  const dismiss = useMutation({
    mutationFn: () => dismissBacklogPrompt({ data: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  return (
    <div className="backlog-entry">
      {prompt.data?.eligible && (
        <div className="backlog-prompt" role="status">
          <span>{category?.name ?? domain.name}有積壓郵件</span>
          <button onClick={category ? onOpen : onDomain}>處理積壓</button>
          <button aria-label="關閉積壓提示" onClick={() => dismiss.mutate()}>
            ×
          </button>
        </div>
      )}
      {category && (
        <button className="island-label" onClick={onOpen}>
          處理積壓
        </button>
      )}
    </div>
  );
}
