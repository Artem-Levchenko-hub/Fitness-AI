import { BookOpenText } from "lucide-react";

/** Мини-ликбез по миорепсам в точке принятия решения (билдер шаблона).
 *  Свёрнут по умолчанию (native <details> — без JS-состояния). Цифры протокола
 *  ниже — «самая обоснованная» вариация, она же дефолты полей билдера:
 *  разгонный 12–20 @ RIR 1–2 + мини 5×5 с отдыхом 20 с. */
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
          мини-сеты по 5 повторов с отдыхом ~20 секунд (5 медленных вдохов).
          Закончил, когда не добираешь 3 повтора — или после 5 мини-сетов.
          Вес на мини-сетах не меняется.
        </p>
        <p>
          <strong className="text-foreground">Куда ставить.</strong> Изоляция,
          тренажёры, упражнения с собственным весом — 2-м и 3-м номером
          тренировки. Не для тяжёлой базы (присед, становая, жим на 1–6
          повторов): там техника под усталостью рушится быстрее, чем мышца
          получает стимул.
        </p>
        <p>
          <strong className="text-foreground">Наука.</strong> Прямое
          исследование миорепсов (Bradshaw и соавт., J Strength Cond Res, 2026):
          за 8 недель тот же рост мышц и силы, что у обычных подходов, при ~30%
          меньшем тоннаже и почти вдвое меньшем времени. Семейство rest-pause
          (короткие паузы): Prestes 2019 — сила та же, толщина мышц бедра и
          выносливость выше; Enes 2021 — при равном объёме рост одинаковый,
          сила в приседе выше. Итог честный: миорепсы не растят больше — они
          растят так же за заметно меньше времени.
        </p>
      </div>
    </details>
  );
}
