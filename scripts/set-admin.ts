/** Выдать (или снять) админку по email. Миграция 0028 уже выдаёт админку
 *  undj00x03@gmail.com, но если аккаунт зарегистрирован ПОСЛЕ её применения —
 *  UPDATE прошёл по нулю строк; тогда запускаем этот скрипт.
 *
 *  Запуск: SKIP_ENV_VALIDATION=1 tsx --env-file=.env.local scripts/set-admin.ts <email> [--revoke]
 */
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import * as schema from "../db/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    throw new Error("Usage: tsx scripts/set-admin.ts <email> [--revoke]");
  }

  const updated = await db
    .update(schema.users)
    .set({ isAdmin: !revoke })
    .where(eq(schema.users.email, email))
    .returning({ id: schema.users.id, email: schema.users.email });

  if (updated.length === 0) {
    throw new Error(
      `Пользователь ${email} не найден — сначала зарегистрируйте аккаунт в приложении`,
    );
  }
  console.log(
    `${revoke ? "Снята" : "Выдана"} админка: ${updated[0]!.email} (${updated[0]!.id})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
