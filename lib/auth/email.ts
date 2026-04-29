import { Resend } from "resend";

import { env } from "@/lib/env";

type SendVerificationRequestParams = {
  identifier: string;
  url: string;
  token: string;
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

/** Шлёт письмо с 6-значным OTP-кодом + резервной ссылкой для десктопа. */
export async function sendOtpEmail({
  identifier: email,
  url,
  token,
}: SendVerificationRequestParams) {
  const result = await resendClient().emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${formatCode(token)} — код входа в ${APP_NAME}`,
    text: textBody(token, url),
    html: htmlBody(token, url),
  });

  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
}

function formatCode(code: string): string {
  // 123456 → "123 456"
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

function textBody(code: string, url: string): string {
  return [
    `Ваш код входа в ${APP_NAME}: ${formatCode(code)}`,
    "",
    `Введите его на странице входа. Код действует ${EXPIRES_MINUTES} минут.`,
    "",
    `Если кода нет под рукой — можно просто открыть ссылку:`,
    url,
    "",
    `Если вы не запрашивали код — просто проигнорируйте письмо.`,
  ].join("\n");
}

function htmlBody(code: string, url: string): string {
  const formatted = formatCode(code);
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Код входа в ${APP_NAME}</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f6f4ef;color:#22221f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
      <tr>
        <td style="padding:40px 32px;background:#ffffff;border-radius:14px;border:1px solid #e8e4dc;">
          <p style="margin:0 0 6px;font-size:13px;color:#7a7468;letter-spacing:0.04em;text-transform:uppercase;">Код входа</p>
          <h1 style="margin:0 0 28px;font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#22221f;">
            ${APP_NAME}
          </h1>

          <div style="background:#f6f4ef;border:1px solid #e8e4dc;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:11px;color:#7a7468;letter-spacing:0.08em;text-transform:uppercase;">Введите этот код на странице входа</p>
            <p style="margin:0;font-family:'SF Mono','Geist Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:600;letter-spacing:0.18em;color:#22221f;">
              ${formatted}
            </p>
          </div>

          <p style="margin:0 0 6px;font-size:13px;color:#52503f;line-height:1.55;">
            Код действует ${EXPIRES_MINUTES} минут. Введите его на странице входа.
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#52503f;line-height:1.55;">
            Если кода нет под рукой — можно сразу открыть ссылку:
          </p>

          <a href="${url}" style="display:inline-block;background:#2c4a3c;color:#f6f4ef;font-weight:500;padding:11px 22px;border-radius:10px;text-decoration:none;font-size:14px;">
            Войти одним кликом
          </a>

          <p style="margin:32px 0 0;font-size:12px;color:#9a9485;line-height:1.5;border-top:1px solid #ece8df;padding-top:20px;">
            Если вы не запрашивали этот код — просто проигнорируйте письмо.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
