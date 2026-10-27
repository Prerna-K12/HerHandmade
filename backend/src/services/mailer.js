// Two emails only: "order received" and "dispatched". Both carry the tracking link.
// With no SMTP_HOST (development) the email is printed in the terminal instead.
const nodemailer = require("nodemailer");
const env = require("../config/env");

const transport = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

const trackingUrl = (token) => `${env.publicBaseUrl}/track/${token}`;

async function send(to, subject, text) {
  if (!transport) {
    if (process.env.NODE_ENV !== "test") console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    return;
  }
  try {
    await transport.sendMail({ from: env.smtp.from, to, subject, text });
  } catch (err) {
    // A failed email must never fail the request.
    console.error("Email failed:", err.message);
  }
}

exports.trackingUrl = trackingUrl;

exports.sendOrderReceived = (order) =>
  send(
    order.email,
    `We received your order ${order.orderRef}`,
    `Hello ${order.businessName},\n\nThank you for your order of ${order.quantity} x ${order.item}.\n` +
      `Reference: ${order.orderRef}\nYou can follow its progress here:\n${trackingUrl(order.trackingToken)}\n\n` +
      `${env.ngo.name}`
  );

exports.sendDispatched = (order) =>
  send(
    order.email,
    `Your order ${order.orderRef} has been dispatched`,
    `Hello ${order.businessName},\n\nYour order of ${order.quantity} x ${order.item} is on its way.\n` +
      `See the photos of the women who made it here:\n${trackingUrl(order.trackingToken)}\n\n` +
      `${env.ngo.name}`
  );
