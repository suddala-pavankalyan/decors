package com.decors.mail;

import org.springframework.web.util.HtmlUtils;

/** The three emails the app sends: HTML for people, plain text as the fallback. */
public final class Templates {
  private Templates() {}

  private static String esc(String s) {
    return HtmlUtils.htmlEscape(s);
  }

  private static String layout(String title, String bodyHtml, String buttonLabel, String href) {
    String button = buttonLabel == null ? "" : """
        <p style="margin:24px 0"><a href="%s" style="display:inline-block;background:#d62976;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">%s</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b">Button not working? Copy this link into your browser:<br><span style="word-break:break-all">%s</span></p>
        """.formatted(esc(href), esc(buttonLabel), esc(href));
    return """
        <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fdf6f1;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b">
        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px">
        <tr><td>
        <p style="margin:0 0 20px;font-size:20px;font-weight:800;letter-spacing:-0.02em">Decors</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">%s</h1>
        %s
        %s
        </td></tr></table>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Decors &middot; You are receiving this because of activity on your account.</p>
        </td></tr></table></body></html>""".formatted(esc(title), bodyHtml, button);
  }

  public static MailMessage verifyEmail(String to, String name, String link) {
    return new MailMessage(to, "Confirm your email address",
        "Hi " + name + ",\n\nWelcome to Decors! Please confirm your email address so you can place orders:\n\n" + link
            + "\n\nThis link works for 24 hours. If you did not create an account, you can ignore this email.\n",
        layout("Confirm your email address",
            "<p style=\"margin:0;line-height:1.6\">Hi " + esc(name) + ", welcome to Decors! Please confirm your email address so you can place orders. This link works for 24 hours.</p>",
            "Confirm my email", link));
  }

  public static MailMessage resetPassword(String to, String name, String link) {
    return new MailMessage(to, "Reset your Decors password",
        "Hi " + name + ",\n\nWe received a request to reset your password. Use this link to choose a new one:\n\n" + link
            + "\n\nIt works for 1 hour and can be used once. If you did not ask for this, you can ignore this email; your password will not change.\n",
        layout("Reset your password",
            "<p style=\"margin:0;line-height:1.6\">Hi " + esc(name) + ", we received a request to reset your password. The link works for 1 hour and can be used once. If you did not ask for this, you can ignore this email and your password will stay as it is.</p>",
            "Choose a new password", link));
  }

  public static MailMessage passwordChanged(String to, String name, String link) {
    return new MailMessage(to, "Your Decors password was changed",
        "Hi " + name + ",\n\nThe password for your Decors account was just changed, and you were signed out everywhere.\n\nIf this was you, there is nothing more to do. If it was not, reset your password right away: " + link + "\n",
        layout("Your password was changed",
            "<p style=\"margin:0;line-height:1.6\">Hi " + esc(name) + ", the password for your Decors account was just changed and you were signed out everywhere. If this was you, there is nothing more to do. If it was not, reset your password right away.</p>",
            "Reset my password", link));
  }

  /** Sent when an order ships or is delivered. {@code carrier} and {@code tracking} may be null. */
  public static MailMessage orderUpdate(String to, String name, String orderId, boolean delivered, String carrier, String tracking, String link) {
    boolean hasCarrier = carrier != null && !carrier.isBlank();
    boolean hasTracking = tracking != null && !tracking.isBlank();
    String shipment = hasCarrier && hasTracking ? "Carrier: " + carrier + ", tracking number " + tracking
        : hasCarrier ? "Carrier: " + carrier
        : hasTracking ? "Tracking number: " + tracking : "";
    String headline = delivered ? "Your order was delivered" : "Your order is on its way";
    String sentence = delivered
        ? "your order " + orderId + " has been delivered. We hope you love it!"
        : "your order " + orderId + " has shipped." + (shipment.isEmpty() ? "" : " " + shipment + ".");
    return new MailMessage(to, headline,
        "Hi " + name + ",\n\n" + sentence.substring(0, 1).toUpperCase() + sentence.substring(1) + "\n\nSee the details: " + link + "\n",
        layout(headline, "<p style=\"margin:0;line-height:1.6\">Hi " + esc(name) + ", " + esc(sentence) + "</p>", "View my order", link));
  }

  /** Sent when an order is cancelled. {@code refund} is the refund amount text (such as "₹90"), or null if nothing was paid. */
  public static MailMessage orderCancelled(String to, String name, String orderId, String refund, String link) {
    String line = refund == null
        ? "Your order " + orderId + " has been cancelled. You were not charged."
        : "Your order " + orderId + " has been cancelled. We are refunding " + refund + " to your original payment method; it usually shows up within 5-7 working days.";
    return new MailMessage(to, "Your Decors order was cancelled",
        "Hi " + name + ",\n\n" + line + "\n\nSee the details: " + link + "\n",
        layout("Your order was cancelled", "<p style=\"margin:0;line-height:1.6\">Hi " + esc(name) + ", " + esc(line.substring(0, 1).toLowerCase() + line.substring(1)) + "</p>", "View my order", link));
  }
}
