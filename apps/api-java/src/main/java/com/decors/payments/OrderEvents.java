package com.decors.payments;

import com.decors.common.Time;
import com.decors.domain.OrderStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** The timeline of an order. Write to it inside the transaction that changes the order. */
@Component
public class OrderEvents {
  private final JdbcClient jdbc;

  public OrderEvents(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void record(String orderId, OrderStatus status, String note) {
    jdbc.sql("""
            insert into "OrderEvent" ("orderId", status, note, "createdAt") values (:o, cast(:s as "OrderStatus"), :n, :t)
            """)
        .param("o", orderId).param("s", status.name()).param("n", note).param("t", Time.now()).update();
  }
}
