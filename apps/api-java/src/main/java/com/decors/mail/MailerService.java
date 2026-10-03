package com.decors.mail;

import com.decors.config.AppProperties;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Sends email over SMTP when SMTP_HOST is set (Mailpit in development, a real provider in production).
 *
 * <p>Without SMTP it prints the message to the console so development still works, but never in production:
 * password-reset and verification links in a log file would be a security hole.
 */
@Service
public class MailerService {
  private static final Logger log = LoggerFactory.getLogger(MailerService.class);
  private final AppProperties props;
  private final JavaMailSenderImpl sender;

  public MailerService(AppProperties props) {
    this.props = props;
    var mail = props.mail();
    if (mail.host() == null || mail.host().isBlank()) {
      this.sender = null;
      return;
    }
    JavaMailSenderImpl s = new JavaMailSenderImpl();
    s.setHost(mail.host());
    s.setPort(mail.port());
    s.setDefaultEncoding("UTF-8");
    Properties p = s.getJavaMailProperties();
    p.put("mail.transport.protocol", "smtp");
    // Fail fast instead of hanging a request when the mail server is down.
    p.put("mail.smtp.connectiontimeout", "8000");
    p.put("mail.smtp.timeout", "15000");
    p.put("mail.smtp.writetimeout", "15000");
    if (mail.secure()) p.put("mail.smtp.ssl.enable", "true");
    else p.put("mail.smtp.starttls.enable", "true"); // used when the server offers it, like most providers
    if (mail.user() != null && !mail.user().isBlank()) {
      s.setUsername(mail.user());
      s.setPassword(mail.password());
      p.put("mail.smtp.auth", "true");
    }
    this.sender = s;
  }

  public void send(MailMessage msg) {
    if (sender != null) {
      try {
        MimeMessage m = sender.createMimeMessage();
        MimeMessageHelper h = new MimeMessageHelper(m, true, "UTF-8");
        h.setFrom(new InternetAddress(props.mail().from(), true));
        h.setTo(msg.to());
        h.setSubject(msg.subject());
        h.setText(msg.text(), msg.html());
        sender.send(m);
      } catch (Exception e) {
        throw new IllegalStateException("Could not send email: " + e.getMessage(), e);
      }
      return;
    }
    if (props.production()) {
      throw new IllegalStateException("Email is not configured: set SMTP_HOST (and the other SMTP_* settings)");
    }
    log.info("SMTP is not configured, so this email is only printed (development):\nTo: {}\nSubject: {}\n\n{}\n",
        msg.to(), msg.subject(), msg.text());
  }
}
