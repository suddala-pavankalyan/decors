package com.decors.payments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decors.domain.OrderStatus;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class OrderFlowTest {
  @Test
  void paidOrdersMoveForwardOneStepAtATime() {
    assertEquals(Optional.of(OrderStatus.PACKED), OrderFlow.next(OrderStatus.PAID));
    assertEquals(Optional.of(OrderStatus.SHIPPED), OrderFlow.next(OrderStatus.PACKED));
    assertEquals(Optional.of(OrderStatus.DELIVERED), OrderFlow.next(OrderStatus.SHIPPED));
  }

  @Test
  void unpaidAndFinishedOrdersCannotMove() {
    assertTrue(OrderFlow.next(OrderStatus.PENDING).isEmpty());
    assertTrue(OrderFlow.next(OrderStatus.DELIVERED).isEmpty());
  }
}
