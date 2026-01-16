import nodemailer from "npm:nodemailer@6.9.8";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
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
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // Use SSL for port 465, TLS for others
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const recipients = Array.isArray(options.to) 
      ? options.to.join(", ") 
      : options.to;

    console.log(`Sending email via SMTP to: ${recipients}`);
    console.log(`Using SMTP host: ${smtpHost}:${smtpPort}`);
    console.log(`From: ${fromName} <${fromEmail}>`);

    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipients,
      subject: options.subject,
      html: options.html,
    });

    console.log("Email sent successfully, messageId:", info.messageId);
    return { 
      success: true, 
      messageId: info.messageId 
    };
  } catch (error) {
    console.error("SMTP error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Greška pri slanju emaila" 
    };
  }
}
