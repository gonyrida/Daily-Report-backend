const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log("📧 Attempting to send email to:", to);
    console.log(
      "📧 Email config - Host:",
      process.env.EMAIL_HOST,
      "Port:",
      process.env.EMAIL_PORT,
      "User:",
      process.env.EMAIL_USER
    );

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true, // Use SSL for port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Modern TLS settings for security
      tls: {
        minVersion: "TLSv1.2",
        ciphers:
          "HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA",
      },
      // Enable debug logging
      debug: true,
      logger: true,
    });

    // Verify connection
    await transporter.verify();
    console.log("✅ Email transporter verified successfully");

    const mailOptions = {
      from: `"CACPM Support" <${process.env.EMAIL_USER}>`,
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
    // Ensure error is thrown with full details for debugging
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

module.exports = sendEmail;
