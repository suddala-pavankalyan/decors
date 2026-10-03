package com.decors.payments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SignatureTest {
  @Test
  void matchesTheKnownHmacSha256TestVector() {
    // RFC 4231 test case 2
    assertEquals("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
        RazorpayGateway.hmac("Jefe", "what do ya want for nothing?".getBytes(StandardCharsets.UTF_8)));
  }

  @Test
  void comparesSignaturesExactly() {
    assertTrue(RazorpayGateway.safeEqual("abc123", "abc123"));
    assertFalse(RazorpayGateway.safeEqual("abc123", "abc124"));
    assertFalse(RazorpayGateway.safeEqual("abc123", "abc12"));
    assertFalse(RazorpayGateway.safeEqual("", "x"));
  }
}
