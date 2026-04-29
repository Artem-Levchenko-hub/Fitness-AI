import { Mail } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Проверьте почту",
};

export default function VerifyRequestPage() {
  return (
    <div className="bg-card text-card-foreground border-border space-y-4 rounded-xl border p-8 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
        <Mail className="size-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Проверьте почту</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Мы отправили вам ссылку для входа. Письмо обычно приходит в течение
        минуты. Если не пришло — проверьте папку «Спам».
      </p>
    </div>
  );
}
