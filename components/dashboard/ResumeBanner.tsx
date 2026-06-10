import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/app/confirm-delete-button";

/** Описание действия «Убрать» для активной сессии круговой/кардио.
 *  `action` — Server Action (cancelCircuitAction / cancelCardioAction),
 *  прокидывается как проп в клиентский ConfirmDeleteButton. */
export type ResumeCancel = {
  action: (formData: FormData) => void | Promise<void>;
  idField: string;
  id: string;
  title: string;
  description: string;
};

/** Единый баннер «Продолжить» для любой активной сессии (силовая / круговая /
 *  кардио). DRY: раньше три почти одинаковых блока жили в трёх формат-тайлах
 *  дашборда — теперь один компонент, формат различает только подпись (label).
 *  Опционально — кнопка «Убрать» (G2b): отменить зависшую активную сессию прямо
 *  из баннера, не заходя в неё. Подтверждение обязательно (ConfirmDeleteButton),
 *  чтобы случайный тап на телефоне не потерял сессию. */
export function ResumeBanner({
  href,
  label,
  cancel,
}: {
  href: string;
  label: string;
  cancel?: ResumeCancel;
}) {
  const banner = (
    <Link
      href={href}
      className="bg-primary text-primary-foreground flex flex-1 items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
          <Play className="size-5 fill-current" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            {label}
          </p>
          <p className="text-base font-semibold tracking-tight">Продолжить</p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-70" aria-hidden="true" />
    </Link>
  );

  if (!cancel) return banner;

  return (
    <div className="flex items-stretch gap-2">
      {banner}
      <ConfirmDeleteButton
        action={cancel.action}
        hidden={{ [cancel.idField]: cancel.id }}
        title={cancel.title}
        description={cancel.description}
        triggerLabel="Убрать"
        confirmLabel="Убрать"
        className="min-h-14 self-stretch rounded-2xl px-4"
      />
    </div>
  );
}
