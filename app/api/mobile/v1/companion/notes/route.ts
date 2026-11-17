import { companionJson, withCompanionUser } from "../response";
import { listAccountNotes } from "./notes";

export const dynamic = "force-dynamic";

export function GET() {
  return withCompanionUser(async (user) => companionJson({
    accountId: user.id,
    notes: await listAccountNotes(user.id),
  }));
}
