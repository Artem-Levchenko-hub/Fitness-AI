import { redirect } from "next/navigation";

/** Орфан-ретайр (H7.2): отдельной вкладки «Заметки» с плейсхолдером «Phase 4»
 *  больше нет — у неё было ноль входящих ссылок и ноль живого функционала.
 *  Markdown-«второй мозг» AI берёт из per-entity заметок (упражнение/тренировка/
 *  микроцикл), не отсюда. Старый URL редиректит на /workouts (прецедент
 *  /circuits·/cardio → /workouts), не 404 — нулевая потеря функций. */
export default async function NotesPage() {
  redirect("/workouts");
}
