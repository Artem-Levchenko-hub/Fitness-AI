/** Толерантный парс ЧАСТИЧНОГО потока разбора тренера — для живой «печати» на
 *  клиенте. Модель (deepseek-thinking) льёт сырой JSON (часто после reasoning и
 *  в ```-ограждении); по мере поступления байт мы достаём уже-готовые поля и
 *  показываем их с эффектом печати. Чистая логика (R-7) — node-юнит-тест.
 *
 *  Финальный валидированный разбор берётся отдельно (`parseTrainerJson` +
 *  trainerSchema) — здесь только «достаточно-хорошо» для прогресс-рендера. */

export type PartialTrainer = {
  overallScore?: number;
  qualityComment?: string;
  whatWorked?: string;
  recommendations?: string[];
  nextSessionFocus?: string;
  motivation?: string;
};

/** Балансирует незакрытые скобки/строку и парсит. null при неудаче. */
function balanceAndParse(s: string): unknown | null {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let closed = s;
  if (inStr) closed += '"';
  for (let i = stack.length - 1; i >= 0; i--) closed += stack[i];
  // Висячая запятая перед закрытием — убрать.
  closed = closed.replace(/,(\s*[}\]])/g, "$1");
  // Висячий «"key":» без значения — убрать перед закрытием.
  closed = closed.replace(/,?\s*"[^"]*"\s*:\s*([}\]])/g, "$1");
  try {
    return JSON.parse(closed);
  } catch {
    return null;
  }
}

/** Тончайший толерантный парс: от первой `{`, отрезая хвост по запятым до
 *  самого длинного валидного префикса. */
function tolerantParse(raw: string): Record<string, unknown> | null {
  const first = raw.indexOf("{");
  if (first < 0) return null;
  let s = raw.slice(first);
  const fence = s.indexOf("```");
  if (fence >= 0) s = s.slice(0, fence);

  let cut = s.length;
  while (cut > 0) {
    const candidate = balanceAndParse(s.slice(0, cut));
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, unknown>;
    }
    const prevComma = s.lastIndexOf(",", cut - 1);
    if (prevComma < 0) break;
    cut = prevComma;
  }
  return null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string");
  return out.length ? out : undefined;
}

/** Достаёт уже-готовые человекочитаемые поля из частичного потока разбора. */
export function extractPartialTrainer(raw: string): PartialTrainer {
  const obj = tolerantParse(raw);
  if (!obj) return {};

  const quality = obj.trainingQuality;
  const qualityComment =
    quality && typeof quality === "object"
      ? str((quality as Record<string, unknown>).comment)
      : undefined;

  const out: PartialTrainer = {};
  if (typeof obj.overallScore === "number") out.overallScore = obj.overallScore;
  if (qualityComment !== undefined) out.qualityComment = qualityComment;
  const whatWorked = str(obj.whatWorked);
  if (whatWorked !== undefined) out.whatWorked = whatWorked;
  const recs = strArray(obj.recommendations);
  if (recs !== undefined) out.recommendations = recs;
  const focus = str(obj.nextSessionFocus);
  if (focus !== undefined) out.nextSessionFocus = focus;
  const motivation = str(obj.motivation);
  if (motivation !== undefined) out.motivation = motivation;
  return out;
}

/** Кадрирование живого стрима разбора. Сервер шлёт две дорожки в одном потоке:
 *  текст ответа (JSON разбора) и «мысли» модели (reasoning). Каждый дельта-кадр
 *  предваряется управляющим символом U+0001 + буквой дорожки. U+0001 не
 *  встречается ни в JSON, ни в кириллице, поэтому `split` восстанавливает
 *  дорожки даже при произвольной нарезке байт по `reader.read()`. */
export const STREAM_FRAME = String.fromCharCode(1);
export const FRAME_TEXT = "T";
export const FRAME_REASONING = "R";

/** Разбирает накопленный кадрированный поток на `{ thinking, json }`. Без кадров
 *  (легаси / нефреймленный ответ) — весь текст считаем JSON (обратная
 *  совместимость со старым `toTextStreamResponse`). */
export function splitTrainerStream(acc: string): {
  thinking: string;
  json: string;
} {
  if (acc.indexOf(STREAM_FRAME) === -1) {
    return { thinking: "", json: acc };
  }

  let thinking = "";
  let json = "";
  for (const part of acc.split(STREAM_FRAME)) {
    if (part.length === 0) continue;
    const channel = part[0];
    const payload = part.slice(1);
    if (channel === FRAME_TEXT) json += payload;
    else if (channel === FRAME_REASONING) thinking += payload;
    // иной/неполный префикс (U+0001 пришёл, буква дорожки — ещё нет) → игнор,
    // следующий read добьёт кадр.
  }
  return { thinking, json };
}
