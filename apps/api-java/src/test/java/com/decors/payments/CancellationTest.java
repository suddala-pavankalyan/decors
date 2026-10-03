package com.decors.payments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decors.domain.OrderStatus;
import com.decors.mail.Templates;
import org.junit.jupiter.api.Test;

class CancellationTest {
  @Test
  void formatsRupeesWithoutPointlessDecimals() {
    assertEquals("₹90", CancellationService.money(9000));
    assertEquals("₹1,500", CancellationService.money(150000));
    assertEquals("₹90.50", CancellationService.money(9050));
  }

  @Test
  void cancelledOrdersCannotAdvance() {
    assertTrue(OrderFlow.next(OrderStatus.CANCELLED).isEmpty());
  }

  @Test
  void emailMentionsRefundOnlyWhenSomethingWasPaid() {
    var paid = Templates.orderCancelled("a@b.c", "Asha", "o1", "₹90", "https://x.test/orders/o1");
    assertTrue(paid.text().contains("refunding ₹90"));
    var unpaid = Templates.orderCancelled("a@b.c", "Asha", "o1", null, "https://x.test/orders/o1");
    assertTrue(unpaid.text().contains("not charged"));
    assertFalse(unpaid.text().contains("refund"));
  }
}
