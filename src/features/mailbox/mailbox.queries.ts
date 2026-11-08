import { queryOptions } from "@tanstack/react-query";
import type { ListMailInput, MailInput } from "../../lib/mailbox";
import { getOverview, listMail, getMail } from "./mailbox.functions";

export const overviewQueryOptions = (ownerKey: string) =>
  queryOptions({
    queryKey: ["mailbox", ownerKey, "overview"],
    queryFn: () => getOverview({ data: {} }),
    retry: false,
  });
export const mailListQueryOptions = (ownerKey: string, input: ListMailInput) =>
  queryOptions({
    queryKey: ["mailbox", ownerKey, "list", input],
    queryFn: () => listMail({ data: input }),
    retry: false,
  });
export const mailDetailQueryOptions = (ownerKey: string, input: MailInput) =>
  queryOptions({
    queryKey: ["mailbox", ownerKey, "detail", input],
    queryFn: () => getMail({ data: input }),
    retry: false,
  });
