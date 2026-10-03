package com.decors.payments;

import com.decors.common.ApiException;
import com.decors.common.Background;
import com.decors.common.Time;
import com.decors.config.AppProperties;
import com.decors.domain.OrderStatus;
import com.decors.domain.ShopOrder;
import com.decors.mail.MailerService;
import com.decors.mail.Templates;
import com.decors.repo.Repositories.OrderRepository;
import java.text.NumberFormat;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Cancels orders that have not shipped and refunds the ones that were paid.
 *
 * <p>The order is marked cancelled first (a single conditional update, so it cannot race with an admin shipping it),
 * then the refund is attempted. If Razorpay fails, the order stays cancelled with refund status FAILED and an admin
 * can retry; the money is never lost track of.
 */
@Service
public class CancellationService {
  private static final Logger log = LoggerFactory.getLogger(CancellationService.class);

  private final JdbcClient jdbc;
  private final TransactionTemplate tx;
  private final OrderRepository orders;
  private final RazorpayGateway gateway;
  private final OrderEvents events;
  private final MailerService mailer;
  private final Background background;
  private final AppProperties props;

  public CancellationService(JdbcClient jdbc, TransactionTemplate tx, OrderRepository orders, RazorpayGateway gateway,
      OrderEvents events, MailerService mailer, Background background, AppProperties props) {
    this.jdbc = jdbc;
    this.tx = tx;
    this.orders = orders;
    this.gateway = gateway;
    this.events = events;
    this.mailer = mailer;
    this.background = background;
    this.props = props;
  }

  /** {@code by} is "you" for the customer or "the shop" for an admin. */
  public void cancel(String orderId, String by, String reason) {
    String cleanReason = reason == null || reason.isBlank() ? null : reason.trim();
    boolean paid = Boolean.TRUE.equals(tx.execute(s -> {
      ShopOrder o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
      int changed = jdbc.sql("""
              update "Order" set status = 'CANCELLED', "cancelReason" = :r,
                     "refundStatus" = case when "razorpayPaymentId" is not null then 'PENDING' end
              where id = :id and status in ('PENDING', 'PAID', 'PACKED')
              """)
          .param("r", cleanReason).param("id", orderId).update();
      if (changed == 0) {
        throw ApiException.conflict(switch (o.status) {
          case CANCELLED -> "This order is already cancelled";
          case SHIPPED, DELIVERED -> "This order has already shipped and can no longer be cancelled";
          default -> "This order cannot be cancelled";
        });
      }
      events.record(orderId, OrderStatus.CANCELLED, "Cancelled by " + by + (cleanReason == null ? "" : ": " + cleanReason));
      return o.razorpayPaymentId != null;
    }));
    if (paid) attemptRefund(orderId);
    ShopOrder after = orders.findById(orderId).orElseThrow();
    sendEmail(after, paid);
  }

  /** Tries to refund a cancelled, paid order. Safe to call repeatedly: only one caller can claim the refund at a time. */
  public void attemptRefund(String orderId) {
    int claimed = jdbc.sql("""
            update "Order" set "refundStatus" = 'PROCESSING'
            where id = :id and status = 'CANCELLED' and "razorpayPaymentId" is not null and "refundStatus" in ('PENDING', 'FAILED')
            """).param("id", orderId).update();
    if (claimed == 0) return;
    ShopOrder o = orders.findById(orderId).orElseThrow();
    try {
      String refundId = gateway.refund(o.razorpayPaymentId, o.amount, o.id);
      tx.executeWithoutResult(s -> {
        jdbc.sql("update \"Order\" set \"refundStatus\" = 'PROCESSED', \"refundId\" = :r, \"refundedAt\" = :t where id = :id")
            .param("r", refundId).param("t", Time.now()).param("id", orderId).update();
        events.record(orderId, OrderStatus.CANCELLED, "Refund of " + money(o.amount) + " issued");
      });
    } catch (RuntimeException e) {
      log.error("Refund for order {} failed: {}", orderId, e.getMessage());
      jdbc.sql("update \"Order\" set \"refundStatus\" = 'FAILED' where id = :id").param("id", orderId).update();
    }
  }

  /** Admin: try again after a failed refund. */
  public void retryRefund(String orderId) {
    ShopOrder o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
    if (!"FAILED".equals(o.refundStatus) && !"PENDING".equals(o.refundStatus)) {
      throw ApiException.conflict(o.refundStatus == null ? "There is nothing to refund on this order" : "This order's refund is already " + o.refundStatus.toLowerCase());
    }
    attemptRefund(orderId);
    ShopOrder after = orders.findById(orderId).orElseThrow();
    if ("FAILED".equals(after.refundStatus)) throw ApiException.badGateway("Could not start the refund. It will be retried.");
  }

  private void sendEmail(ShopOrder o, boolean paid) {
    jdbc.sql("select name, email from \"User\" where id = :id").param("id", o.userId)
        .query((rs, n) -> new String[] {rs.getString("name"), rs.getString("email")}).optional()
        .ifPresent(u -> background.run("Sending the cancellation email", () -> mailer.send(
            Templates.orderCancelled(u[1], u[0], o.id, paid ? money(o.amount) : null, props.webUrl() + "/orders/" + o.id))));
  }

  static String money(int paise) {
    NumberFormat f = NumberFormat.getCurrencyInstance(Locale.of("en", "IN"));
    f.setMaximumFractionDigits(paise % 100 == 0 ? 0 : 2);
    return f.format(paise / 100.0);
  }
}
