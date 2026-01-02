# Email Delivery Fix Tasks

## Current Issues

- Reset password emails not arriving despite Nodemailer reporting "sent"
- Plain text HTML triggering spam filters
- Missing TLS settings for secure connection
- Errors not surfaced to API responses
- No proper HTML email template

## Tasks to Complete

- [ ] Update sendEmail.js with proper TLS settings and secure connection
- [ ] Add proper HTML email template for password reset
- [ ] Improve error handling to surface SMTP errors to API responses
- [ ] Update forgotPassword controller to handle email errors properly
- [ ] Add test email route for verification
- [ ] Test email delivery and verify in inbox/spam folders
- [ ] Check Gmail security activity and spam filtering
