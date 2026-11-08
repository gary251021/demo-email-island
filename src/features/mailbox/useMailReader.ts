import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MailInput } from "../../lib/mailbox";
import { markMailRead } from "./mailbox.functions";
import { mailDetailQueryOptions } from "./mailbox.queries";

/** Mount this reader only while its full text is displayed. */
export function useMailReader(ownerKey: string, input: MailInput) {
  const queryClient = useQueryClient();
  const detail = useQuery(mailDetailQueryOptions(ownerKey, input));
  const attempted = useRef(false);
  const save = useMutation({
    mutationFn: () => markMailRead({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox", ownerKey] });
    },
  });
  const { mutate } = save;
  const readAt = detail.data?.readAt;

  useEffect(() => {
    if (readAt === null && !attempted.current) {
      attempted.current = true;
      mutate();
    }
  }, [readAt, mutate]);

  return { detail, save };
}
