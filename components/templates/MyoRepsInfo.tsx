import { BookOpenText } from "lucide-react";

/** Мини-ликбез по миорепсам в точке принятия решения (билдер шаблона).
 *  Свёрнут по умолчанию (native <details> — без JS-состояния). Цифры протокола
 *  ниже совпадают с дефолтами продукта: активация + 3 мини по 30%, 20 с. */
export function MyoRepsInfo() {
  return (
    <details className="group mt-2">
      <summary className="text-muted-foreground hover:text-foreground flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-medium select-none [&::-webkit-details-marker]:hidden">
        <BookOpenText className="size-3.5" aria-hidden="true" />
        Что такое миорепсы и почему они работают
        <span
          className="ml-auto transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>
      <div className="text-muted-foreground mt-2 space-y-2 text-xs leading-relaxed">
        <p>
          <strong className="text-foreground">Суть.</strong> Мышцу растят
          «тяжёлые» повторы возле отказа. В обычном подходе первые повторы —
          разгон, стимул дают последние. Миорепсы убирают лишнее: один
          «разгонный» подход почти до отказа, затем короткие мини-сеты на том же
          весе — усталость сохраняется, и почти каждый мини-повтор работает как
          последние повторы обычного подхода.
        </p>
        <p>
          <strong className="text-foreground">Как делать.</strong> Вес ~60% от
          максимума: разгонный 12–20 повторов, оставив 1–2 в запасе. Дальше
          три мини-сета примерно по 30% повторов первого подхода с отдыхом 20
          секунд (никогда не дольше 30). Например, после 10 повторов цель мини
          — 3; после 12 — 4. Вес на мини-сетах не меняется. Если техника
          рушится или не получается выполнить план — серия заканчивается, а не
          продавливается любой ценой.
        </p>
        <p>
          <strong className="text-foreground">Куда ставить.</strong> Изоляция,
          тренажёры, упражнения с собственным весом — 2-м и 3-м номером
          тренировки. Не для тяжёлой базы (присед, становая, жим на 1–6
          повторов): там техника под усталостью рушится быстрее, чем мышца
          получает стимул.
        </p>
        <p>
          <strong className="text-foreground">Наука.</strong> Данные по
          rest-pause/cluster-подходам поддерживают их как экономную по времени
          альтернативу обычным сетам, но не доказывают превосходство точного
          Myo-протокола. Поэтому тренер использует его как понятный вариант для
          контролируемых упражнений, а не как обязательную замену базе.
        </p>
      </div>
    </details>
  );
}
