package com.decors.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class OrderUpdateEmailTest {
  @Test
  void shippedEmailCarriesCarrierAndTracking() {
    var m = Templates.orderUpdate("a@b.c", "Asha", "o1", false, "Delhivery", "DL123", "https://x.test/orders/o1");
    assertTrue(m.subject().contains("on its way"));
    assertTrue(m.text().contains("Delhivery"));
    assertTrue(m.text().contains("DL123"));
    assertTrue(m.text().contains("https://x.test/orders/o1"));
  }

  @Test
  void shippedEmailWorksWithoutTracking() {
    var m = Templates.orderUpdate("a@b.c", "Asha", "o1", false, null, null, "https://x.test/o");
    assertTrue(m.text().contains("has shipped."));
    assertFalse(m.text().contains("null"));
  }

  @Test
  void deliveredEmailAndEscaping() {
    var m = Templates.orderUpdate("a@b.c", "<b>Asha</b>", "o1", true, null, null, "https://x.test/o");
    assertTrue(m.subject().contains("delivered"));
    assertFalse(m.html().contains("<b>Asha</b>"));
  }
}
