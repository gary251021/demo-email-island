import { prepareIssueBranches } from "../scripts/prepareIssueBranches.mjs";
import { runCli } from "../scripts/shared.mjs";
export { validatePrepareOptions } from "../scripts/prepareIssueBranches.mjs";

export function prepare({ repo = process.cwd(), ...options }) {
  try {
    return prepareIssueBranches(options, repo);
  } catch (error) {
    error.message += " Inspect checkout, branches and merge state before retrying; completed changes are retained.";
    throw error;
  }
}

runCli(import.meta.url, { prepare });
