import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassificationStatus,
  retryClassification,
  refreshClassification,
} from "./classification.functions";

export function ClassificationStatus({ ownerKey }: { ownerKey: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["classification", ownerKey],
    queryFn: () => getClassificationStatus({ data: {} }),
    refetchInterval: 1000,
    retry: false,
  });
  useEffect(() => {
    if (query.data?.status && query.data.status !== "pending") {
      void client.invalidateQueries({ queryKey: ["mailbox", ownerKey] });
    }
  }, [query.data?.status, query.data?.revision, client, ownerKey]);
  const action = useMutation({
    mutationFn: (operation: "retry" | "refresh") =>
      (operation === "retry" ? retryClassification : refreshClassification)({
        data: {},
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["classification", ownerKey] }),
  });
  return (
    <div className="classification-control">
      <span role="status" aria-label="郵件分類">
        {query.data?.status ?? "pending"}
      </span>
      {query.data?.status === "complete with error" && (
        <button
          className="text-button"
          disabled={action.isPending}
          onClick={() => action.mutate("retry")}
        >
          重試
        </button>
      )}
      <button
        className="text-button"
        disabled={action.isPending || query.data?.status === "pending"}
        onClick={() => action.mutate("refresh")}
      >
        更新分類
      </button>
      {(query.isError || action.isError) && (
        <span role="alert">分類狀態暫時無法更新。</span>
      )}
    </div>
  );
}
