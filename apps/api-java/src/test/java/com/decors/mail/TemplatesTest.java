package com.decors.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class TemplatesTest {
  @Test
  void escapesTheNameAndLinkInHtml() {
    var m = Templates.verifyEmail("a@b.c", "<script>alert(1)</script>", "https://x.test/v?token=a&b=\"c\"");
    assertFalse(m.html().contains("<script>alert(1)</script>"));
    assertTrue(m.html().contains("&lt;script&gt;"));
    assertTrue(m.html().contains("token=a&amp;b=&quot;c&quot;"));
  }

  @Test
  void textVersionCarriesTheRawLink() {
    var m = Templates.resetPassword("a@b.c", "Asha", "https://x.test/r?token=abc");
    assertTrue(m.text().contains("https://x.test/r?token=abc"));
    assertTrue(m.html().contains("charset=\"utf-8\""));
  }

  @Test
  void passwordChangedLinksToForgotPassword() {
    var m = Templates.passwordChanged("a@b.c", "Asha", "https://x.test/forgot-password");
    assertTrue(m.text().contains("https://x.test/forgot-password"));
    assertTrue(m.subject().toLowerCase().contains("password"));
  }
}
