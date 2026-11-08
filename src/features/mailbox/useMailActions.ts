import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MailInput, ReplyInput, SnapshotInput } from "../../lib/mailbox";
import {
  archiveMail,
  archiveUnreadSnapshot,
  replyToMail,
} from "./mailbox.functions";

export function useMailActions(ownerKey: string) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["mailbox", ownerKey] });
  const reply = useMutation({
    mutationFn: (data: ReplyInput) => replyToMail({ data }),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: (data: MailInput) => archiveMail({ data }),
    onSuccess: refresh,
  });
  const snapshot = useMutation({
    mutationFn: (data: SnapshotInput) => archiveUnreadSnapshot({ data }),
    onSuccess: refresh,
  });
  return { reply, archive, snapshot };
}
