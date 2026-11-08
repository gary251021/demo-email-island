// Separate processes exercise the production SQLite transaction and idempotency ledger.
import { z } from "zod";
import { commitInput } from "../../lib/backlog";
import { commitBacklog } from "./backlog.server";
const owner = z.string().parse(process.argv[2]);
const input = commitInput.parse(JSON.parse(z.string().parse(process.argv[3])));
console.log(JSON.stringify(commitBacklog(owner, input)));
