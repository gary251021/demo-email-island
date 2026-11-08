import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.EMAIL_ISLAND_DB_PATH = join(
  mkdtempSync(join(tmpdir(), "email-island-unit-")),
  "mail.sqlite",
);
