import { createServerFn } from "@tanstack/react-start";
import { emptyInput } from "../../lib/session";
import { correctionInput } from "../../lib/classification";
import { requireOwner } from "../session/session.server";
import {
  classificationStatus,
  retryFailed,
  refreshStale,
  setCategory,
  startClassifiedMailbox,
} from "./classification.server";
import { dispatchPending } from "./queue.server";

export const getClassificationStatus = createServerFn({ method: "GET" })
  .validator(emptyInput)
  .handler(async () => classificationStatus(await requireOwner()));
export const retryClassification = createServerFn({ method: "POST" })
  .validator(emptyInput)
  .handler(async () => {
    const owner = await requireOwner();
    retryFailed(owner);
    await dispatchPending();
    return classificationStatus(owner);
  });
export const refreshClassification = createServerFn({ method: "POST" })
  .validator(emptyInput)
  .handler(async () => {
    const owner = await requireOwner();
    refreshStale(owner);
    await dispatchPending();
    return classificationStatus(owner);
  });
export const setMailCategory = createServerFn({ method: "POST" })
  .validator(correctionInput)
  .handler(async ({ data }) =>
    setCategory(await requireOwner(), data.mailId, data.subcategoryId),
  );
export const startClassifiedDemo = createServerFn({ method: "POST" })
  .validator(emptyInput)
  .handler(async () => {
    const result = startClassifiedMailbox(await requireOwner());
    await dispatchPending();
    return result;
  });
