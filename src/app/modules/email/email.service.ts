import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );

const transporter =
  env.EMAIL_DELIVERY_MODE === "smtp"
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        disableFileAccess: true,
        disableUrlAccess: true,
      })
    : null;

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  developmentLink?: string;
};

const send = async (input: SendMailInput): Promise<boolean> => {
  try {
    if (!transporter) {
      console.info(`[mail:console] ${input.subject} -> ${input.to}`);
      if (input.developmentLink) {
        console.info(`[mail:console] ${input.developmentLink}`);
      }
      return true;
    }

    await transporter.sendMail({
      from: {
        name: env.MAIL_FROM_NAME,
        address: env.MAIL_FROM_EMAIL,
      },
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return true;
  } catch (error) {
    console.error("Email delivery failed:", error);
    return false;
  }
};

const sendEmailVerification = async (input: {
  email: string;
  firstName: string;
  token: string;
}) => {
  const link = `${env.CLIENT_APP_URL}/verify-email?token=${encodeURIComponent(input.token)}`;
  const safeName = escapeHtml(input.firstName);

  return send({
    to: input.email,
    subject: "Verify your ProcuraX email",
    text: `Hi ${input.firstName}, verify your ProcuraX email using this link: ${link}`,
    html: `<p>Hi ${safeName},</p><p>Verify your ProcuraX email using the link below.</p><p><a href="${link}">Verify email</a></p>`,
    developmentLink: link,
  });
};

const sendPasswordReset = async (input: {
  email: string;
  firstName: string;
  token: string;
}) => {
  const link = `${env.CLIENT_APP_URL}/reset-password?token=${encodeURIComponent(input.token)}`;
  const safeName = escapeHtml(input.firstName);

  return send({
    to: input.email,
    subject: "Reset your ProcuraX password",
    text: `Hi ${input.firstName}, reset your ProcuraX password using this link: ${link}`,
    html: `<p>Hi ${safeName},</p><p>Use the link below to reset your ProcuraX password.</p><p><a href="${link}">Reset password</a></p>`,
    developmentLink: link,
  });
};

export const EmailService = {
  sendEmailVerification,
  sendPasswordReset,
};
