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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** What the shop owner does with orders: find them, and move paid ones through packing, shipping and delivery. */
@Service
public class AdminOrdersService {
  private final JdbcClient jdbc;
  private final OrderRepository orders;
  private final OrdersService ordersService;
  private final TransactionTemplate tx;
  private final MailerService mailer;
  private final Background background;
  private final AppProperties props;
  private final OrderEvents events;
  private final CancellationService cancellation;

  public AdminOrdersService(JdbcClient jdbc, OrderRepository orders, OrdersService ordersService, TransactionTemplate tx,
      MailerService mailer, Background background, AppProperties props, OrderEvents events, CancellationService cancellation) {
    this.events = events;
    this.cancellation = cancellation;
    this.jdbc = jdbc;
    this.orders = orders;
    this.ordersService = ordersService;
    this.tx = tx;
    this.mailer = mailer;
    this.background = background;
    this.props = props;
  }

  public record OrderRow(String id, LocalDateTime createdAt, String status, int amount, String customerName,
      String customerEmail, String shipName, String shipCity, long itemCount) {}
  public record OrderPage(long total, List<OrderRow> items, boolean hasMore, Map<String, Long> counts) {}

  public OrderPage list(String status, String q, int limit, int offset) {
    StringBuilder where = new StringBuilder(" where 1 = 1");
    Map<String, Object> params = new LinkedHashMap<>();
    if (status != null && !status.isBlank()) {
      where.append(" and o.status = cast(:status as \"OrderStatus\")");
      params.put("status", parseStatus(status).name());
    }
    String text = q == null ? "" : q.trim().toLowerCase();
    if (!text.isEmpty()) {
      where.append("""
           and (lower(o.id) = :exact or lower(u.email) like :like escape '\\' or lower(u.name) like :like escape '\\'
                or lower(o."shipName") like :like escape '\\' or lower(coalesce(o."trackingNumber", '')) like :like escape '\\')
          """);
      params.put("exact", text);
      params.put("like", "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
    }
    String from = " from \"Order\" o join \"User\" u on u.id = o.\"userId\"";
    var count = jdbc.sql("select count(*)" + from + where);
    params.forEach(count::param);
    long total = count.query(Long.class).single();
    var rows = jdbc.sql("""
        select o.id, o."createdAt", o.status::text as status, o.amount, u.name as cname, u.email as cemail,
               o."shipName", o."shipCity", (select count(*) from "OrderItem" i where i."orderId" = o.id) as items
        """ + from + where + " order by o.\"createdAt\" desc, o.id asc limit :limit offset :offset");
    params.forEach(rows::param);
    List<OrderRow> items = rows.param("limit", limit).param("offset", offset)
        .query((rs, n) -> new OrderRow(rs.getString("id"), rs.getObject("createdAt", LocalDateTime.class), rs.getString("status"),
            rs.getInt("amount"), rs.getString("cname"), rs.getString("cemail"), rs.getString("shipName"),
            rs.getString("shipCity"), rs.getLong("items")))
        .list();
    Map<String, Long> counts = new LinkedHashMap<>();
    for (OrderStatus s : OrderStatus.values()) counts.put(s.name(), 0L);
    jdbc.sql("select status::text as s, count(*) as c from \"Order\" group by status")
        .query((rs, n) -> Map.entry(rs.getString("s"), rs.getLong("c"))).list().forEach(e -> counts.put(e.getKey(), e.getValue()));
    return new OrderPage(total, items, (long) offset + items.size() < total, counts);
  }

  public Map<String, Object> get(String id) {
    ShopOrder o = orders.findById(id).orElseThrow(() -> ApiException.notFound("Order not found"));
    Map<String, Object> view = new LinkedHashMap<>(ordersService.views(List.of(o)).get(0));
    jdbc.sql("select name, email from \"User\" where id = :id").param("id", o.userId)
        .query((rs, n) -> Map.of("name", rs.getString("name"), "email", rs.getString("email")))
        .optional().ifPresent(c -> view.put("customer", c));
    view.put("canCancel", o.status == OrderStatus.PENDING || o.status == OrderStatus.PAID || o.status == OrderStatus.PACKED);
    view.put("nextStatus", OrderFlow.next(o.status).map(Enum::name).orElse(null));
    return view;
  }

  public Map<String, Object> cancel(String id, String reason) {
    cancellation.cancel(id, "the shop", reason);
    return get(id);
  }

  public Map<String, Object> retryRefund(String id) {
    cancellation.retryRefund(id);
    return get(id);
  }

  /** Moves a paid order to its next step. Shipping can record the carrier and tracking number. */
  public Map<String, Object> advance(String id, String status, String carrier, String trackingNumber) {
    OrderStatus target = parseStatus(status);
    String[] customer = new String[2];
    ShopOrder[] after = new ShopOrder[1];
    tx.executeWithoutResult(s -> {
      ShopOrder o = orders.findById(id).orElseThrow(() -> ApiException.notFound("Order not found"));
      OrderStatus expected = OrderFlow.next(o.status).orElseThrow(() -> ApiException.conflict(
          o.status == OrderStatus.PENDING ? "This order has not been paid yet" : "This order is already " + o.status.name().toLowerCase()));
      if (target != expected) {
        throw ApiException.conflict("The next step for this order is " + expected.name().toLowerCase() + ", not " + target.name().toLowerCase());
      }
      boolean shipping = target == OrderStatus.SHIPPED;
      String c = shipping ? clean(carrier) : null;
      String t = shipping ? clean(trackingNumber) : null;
      // Conditional on the current status, so two admins pressing the button together move it only one step.
      int changed = jdbc.sql("""
              update "Order" set status = cast(:to as "OrderStatus"), carrier = coalesce(:c, carrier), "trackingNumber" = coalesce(:t, "trackingNumber")
              where id = :id and status = cast(:from as "OrderStatus")
              """)
          .param("to", target.name()).param("from", o.status.name()).param("c", c).param("t", t).param("id", id).update();
      if (changed == 0) throw ApiException.conflict("This order was just updated by someone else. Reload and try again.");
      String note = switch (target) {
        case PACKED -> "Packed and ready to ship";
        case SHIPPED -> "Shipped" + (c == null ? "" : " with " + c) + (t == null ? "" : " (tracking " + t + ")");
        default -> "Delivered";
      };
      events.record(id, target, note);
      jdbc.sql("select name, email from \"User\" where id = :id").param("id", o.userId)
          .query((rs, n) -> new String[] {rs.getString("name"), rs.getString("email")}).optional()
          .ifPresent(r -> { customer[0] = r[0]; customer[1] = r[1]; });
    });
    ShopOrder fresh = orders.findById(id).orElseThrow();
    if (customer[1] != null && (target == OrderStatus.SHIPPED || target == OrderStatus.DELIVERED)) {
      String link = props.webUrl() + "/orders/" + id;
      background.run("Sending the order update email", () -> mailer.send(Templates.orderUpdate(
          customer[1], customer[0], id, target == OrderStatus.DELIVERED, fresh.carrier, fresh.trackingNumber, link)));
    }
    return get(id);
  }

  private static String clean(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }

  static OrderStatus parseStatus(String s) {
    try {
      return OrderStatus.valueOf(s.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw ApiException.badRequest("status must be one of the following values: " + String.join(", ",
          Arrays.stream(OrderStatus.values()).map(Enum::name).toList()));
    }
  }
}
