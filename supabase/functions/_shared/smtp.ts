import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
  const fromName = Deno.env.get("SMTP_FROM_NAME") || "Ketering";

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    console.error("Missing SMTP configuration:", {
      hasHost: !!smtpHost,
      hasUser: !!smtpUser,
      hasPassword: !!smtpPassword,
      hasFromEmail: !!fromEmail,
    });
    return { 
      success: false, 
      error: "SMTP konfiguracija nije kompletna" 
    };
  }

  try {
    // Port 465 = SSL/TLS (direct encryption)
    // Port 587 = STARTTLS (upgrade encryption)
    const useTls = smtpPort === 465;
    
    console.log(`Connecting to SMTP: ${smtpHost}:${smtpPort} (TLS: ${useTls})`);
    console.log(`From: ${fromName} <${fromEmail}>`);

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: useTls,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    console.log(`Sending email to: ${recipients.join(", ")}`);
    console.log(`Subject: ${options.subject}`);

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject: options.subject,
      content: options.text ?? htmlToPlainText(options.html),
      html: options.html,
    });

    await client.close();

    console.log("Email sent successfully");
    return { 
      success: true, 
      messageId: `smtp-${Date.now()}` 
    };
  } catch (error) {
    console.error("SMTP error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Greška pri slanju emaila" 
    };
  }
}
