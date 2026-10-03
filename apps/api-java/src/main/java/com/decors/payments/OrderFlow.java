package com.decors.payments;

import com.decors.domain.OrderStatus;
import java.util.Optional;

/** The fulfilment steps an admin can move a paid order through, one at a time and never backwards. */
public final class OrderFlow {
  private OrderFlow() {}

  public static Optional<OrderStatus> next(OrderStatus current) {
    return switch (current) {
      case PAID -> Optional.of(OrderStatus.PACKED);
      case PACKED -> Optional.of(OrderStatus.SHIPPED);
      case SHIPPED -> Optional.of(OrderStatus.DELIVERED);
      case PENDING, DELIVERED -> Optional.empty();
    };
  }
}
