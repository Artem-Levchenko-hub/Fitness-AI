import "server-only";

import { Resend } from "resend";

import { formatRub } from "@/lib/billing/money";
import { env } from "@/lib/env";

let resend: Resend | null = null;
function client() {
  resend ??= new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendRenewalReminder(input: {
  email: string;
  amountKopecks: number;
  chargeAt: Date;
}) {
  const date = input.chargeAt.toLocaleDateString("ru-RU", {
    dateStyle: "long",
    timeZone: "Europe/Moscow",
  });
  const amount = formatRub(input.amountKopecks);
  const billingUrl = `${env.NEXT_PUBLIC_APP_URL}/billing`;

  const result = await client().emails.send({
    from: env.EMAIL_FROM,
    to: input.email,
    subject: `Скоро продление Fitness AI Pro — ${amount}`,
    text: [
      `Подписка Fitness AI Pro автоматически продлится ${date}.`,
      `Сумма следующего платежа: ${amount}.`,
      "",
      `Отключить автопродление можно до даты списания: ${billingUrl}`,
      "",
      `Поддержка: ${env.LEGAL_SUPPORT_EMAIL ?? env.EMAIL_FROM}`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="ru">
  <body style="font-family:Arial,sans-serif;color:#222;padding:24px">
    <h1 style="font-size:22px">Скоро продление Fitness AI Pro</h1>
    <p>Дата следующего списания: <strong>${date}</strong>.</p>
    <p>Сумма: <strong>${amount}</strong>.</p>
    <p><a href="${billingUrl}">Управлять подпиской или отключить автопродление</a></p>
    <p style="color:#666;font-size:13px">Поддержка: ${env.LEGAL_SUPPORT_EMAIL ?? env.EMAIL_FROM}</p>
  </body>
</html>`,
  });
  if (result.error) {
    throw new Error("Renewal reminder send failed");
  }
}
