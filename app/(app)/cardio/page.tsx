import { redirect } from "next/navigation";

/** Единый поток: отдельной вкладки истории кардио больше нет — вся история
 *  (силовые + круговые + кардио) живёт одним списком на /workouts. Конкретная
 *  кардио-сессия по-прежнему доступна по /cardio/[id], создание — через /create. */
export default async function CardioHistoryPage() {
  redirect("/workouts");
}
