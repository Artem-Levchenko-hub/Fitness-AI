import { redirect } from "next/navigation";

/** Единый поток: отдельной вкладки истории круговых больше нет — вся история
 *  (силовые + круговые + кардио) живёт одним списком на /workouts. Конкретная
 *  круговая по-прежнему доступна по /circuits/[id], создание — через /create. */
export default async function CircuitsHistoryPage() {
  redirect("/workouts");
}
