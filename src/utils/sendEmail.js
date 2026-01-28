const nodemailer = require("nodemailer");
const config = require("../config/env"); // import your config

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log("📧 Attempting to send email to:", to);
    console.log("📧 Email config -", {
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      user: config.EMAIL_USER,
      passExists: !!config.EMAIL_PASS,
      from: config.EMAIL_FROM,
    });

    const transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      secure: config.EMAIL_PORT == 465, // true for 465 SSL, false for 587 TLS
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
      tls: {
        minVersion: "TLSv1.2",
        ciphers:
          "HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA",
      },
      debug: true,
      logger: true,
    });

    // Verify connection
    await transporter.verify();
    console.log("✅ Email transporter verified successfully");

    const mailOptions = {
      from: `"CACPM Support" <${config.EMAIL_FROM}>`,
      to,
      subject,
      html,
    };

    console.log("📧 Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    console.log("📧 Email response:", info.response);

    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    console.error("❌ Error details:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

module.exports = sendEmail;
