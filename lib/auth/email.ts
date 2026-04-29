import { Resend } from "resend";

import { env } from "@/lib/env";

type SendVerificationRequestParams = {
  identifier: string;
  url: string;
  expires: Date;
  provider: { from?: string; apiKey?: string };
};

const APP_NAME = "Fitness SaaS";
const EXPIRES_MINUTES = 10;

let _resend: Resend | null = null;
function resendClient() {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendMagicLinkEmail({
  identifier: email,
  url,
}: SendVerificationRequestParams) {
  const result = await resendClient().emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `Войти в ${APP_NAME}`,
    text: textBody(url),
    html: htmlBody(url),
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
}

function textBody(url: string) {
  return [
    `Войдите в ${APP_NAME}, перейдя по ссылке:`,
    "",
    url,
    "",
    `Ссылка действительна ${EXPIRES_MINUTES} минут. Если вы не запрашивали этот вход — просто проигнорируйте письмо.`,
  ].join("\n");
}

function htmlBody(url: string) {
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Войти в ${APP_NAME}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#0a0a0a;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
      <tr>
        <td style="padding:32px;background:#171717;border-radius:16px;border:1px solid #262626;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#fafafa;">Войти в ${APP_NAME}</h1>
          <p style="margin:0 0 28px;color:#a3a3a3;line-height:1.55;font-size:15px;">
            Нажмите кнопку ниже, чтобы войти. Ссылка действительна ${EXPIRES_MINUTES} минут.
          </p>
          <a href="${url}" style="display:inline-block;background:#a78bfa;color:#0a0a0a;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:15px;">
            Войти
          </a>
          <p style="margin:32px 0 0;font-size:12px;color:#737373;line-height:1.5;">
            Если кнопка не работает, скопируйте и откройте ссылку:
            <br />
            <a href="${url}" style="color:#a78bfa;word-break:break-all;">${url}</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#737373;">
            Если вы не запрашивали этот вход — просто проигнорируйте письмо.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
