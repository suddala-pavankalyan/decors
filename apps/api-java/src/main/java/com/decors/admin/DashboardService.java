package com.decors.admin;

import com.decors.common.ApiException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Numbers for the admin dashboard. "Sales" means orders that are paid and not cancelled (paid, packed, shipped or
 * delivered), counted on the day they were paid, in Indian time. Each figure comes with the previous period of the same
 * length so the page can show whether things are up or down.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {
  static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
  public static final List<Integer> RANGES = List.of(7, 30, 90);
  private static final String SOLD = "status::text in ('PAID', 'PACKED', 'SHIPPED', 'DELIVERED')";
  public static final int LOW_STOCK = 5;

  public record Kpi(long value, long previous) {}
  public record Day(String date, long revenuePaise, long orders) {}
  public record TopProduct(String productId, String name, long units, long salesPaise) {}
  public record LowStockItem(String id, String name, int stock) {}
  public record RecentOrder(String id, LocalDateTime createdAt, String customerName, int amountPaise, String status) {}
  public record Dashboard(int days, String from, String to, Kpi revenue, Kpi orders, Kpi newCustomers, Kpi refunded, long toShip,
      long awaitingPayment, Map<String, Long> statusCounts, List<Day> daily, List<TopProduct> topProducts, List<LowStockItem> lowStock,
      List<RecentOrder> recent) {}

  public record Customer(String id, String name, String email, boolean emailVerified, String role, LocalDateTime createdAt, long orders,
      long spentPaise, LocalDateTime lastOrderAt) {}
  public record CustomerPage(long total, List<Customer> items, boolean hasMore) {}

  private final JdbcClient jdbc;

  public DashboardService(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  private static LocalDateTime utcStart(LocalDate day) {
    return day.atStartOfDay(SHOP_ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
  }

  public Dashboard dashboard(int days, LocalDate today) {
    if (!RANGES.contains(days)) throw ApiException.badRequest("days must be one of " + RANGES);
    LocalDate first = today.minusDays(days - 1L);
    LocalDateTime from = utcStart(first), to = utcStart(today.plusDays(1));
    LocalDateTime prevFrom = utcStart(first.minusDays(days)), prevTo = from;

    long[] now = sold(from, to), before = sold(prevFrom, prevTo);
    Kpi revenue = new Kpi(now[0], before[0]);
    Kpi orders = new Kpi(now[1], before[1]);
    Kpi customers = new Kpi(count("select count(*) from \"User\" where \"createdAt\" >= :a and \"createdAt\" < :b", from, to),
        count("select count(*) from \"User\" where \"createdAt\" >= :a and \"createdAt\" < :b", prevFrom, prevTo));
    String refundSql = "select coalesce(sum(amount), 0) from \"Order\" where \"refundStatus\" = 'PROCESSED' and \"refundedAt\" >= :a and \"refundedAt\" < :b";
    Kpi refunded = new Kpi(count(refundSql, from, to), count(refundSql, prevFrom, prevTo));

    Map<String, Long> statusCounts = new LinkedHashMap<>();
    for (String s : List.of("PENDING", "PAID", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED")) statusCounts.put(s, 0L);
    jdbc.sql("select status::text, count(*) from \"Order\" group by status")
        .query((rs, n) -> Map.entry(rs.getString(1), rs.getLong(2))).list().forEach(e -> statusCounts.put(e.getKey(), e.getValue()));

    List<Day> daily = jdbc.sql("""
            select d::date as day, coalesce(sum(o.amount), 0) as revenue, count(o.id) as orders
            from generate_series(cast(:first as date), cast(:last as date), interval '1 day') d
            left join "Order" o on o.%s and ((o."paidAt" at time zone 'UTC') at time zone 'Asia/Kolkata')::date = d::date
            group by d order by d
            """.formatted(SOLD))
        .param("first", first).param("last", today)
        .query((rs, n) -> new Day(rs.getString("day"), rs.getLong("revenue"), rs.getLong("orders"))).list();

    List<TopProduct> top = jdbc.sql("""
            select i."productId", i.name, sum(i.qty) as units, sum(i."unitPricePaise"::bigint * i.qty) as sales
            from "OrderItem" i join "Order" o on o.id = i."orderId"
            where o.%s and o."paidAt" >= :a and o."paidAt" < :b
            group by i."productId", i.name order by sales desc, i.name limit 5
            """.formatted(SOLD))
        .param("a", from).param("b", to)
        .query((rs, n) -> new TopProduct(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4))).list();

    List<LowStockItem> low = jdbc.sql("select id, name, stock from \"Product\" where stock <= :t order by stock, name limit 10")
        .param("t", LOW_STOCK).query((rs, n) -> new LowStockItem(rs.getString(1), rs.getString(2), rs.getInt(3))).list();

    List<RecentOrder> recent = jdbc.sql("""
            select o.id, o."createdAt", u.name, o.amount, o.status::text from "Order" o join "User" u on u.id = o."userId"
            order by o."createdAt" desc, o.id limit 8
            """)
        .query((rs, n) -> new RecentOrder(rs.getString(1), rs.getObject(2, LocalDateTime.class), rs.getString(3), rs.getInt(4), rs.getString(5))).list();

    return new Dashboard(days, first.toString(), today.toString(), revenue, orders, customers, refunded,
        statusCounts.get("PAID") + statusCounts.get("PACKED"), statusCounts.get("PENDING"), statusCounts, daily, top, low, recent);
  }

  public Dashboard dashboard(int days) {
    return dashboard(days, LocalDate.now(SHOP_ZONE));
  }

  private long[] sold(LocalDateTime a, LocalDateTime b) {
    return jdbc.sql("select coalesce(sum(amount), 0), count(*) from \"Order\" where " + SOLD + " and \"paidAt\" >= :a and \"paidAt\" < :b")
        .param("a", a).param("b", b).query((rs, n) -> new long[] {rs.getLong(1), rs.getLong(2)}).single();
  }

  private long count(String sql, LocalDateTime a, LocalDateTime b) {
    return jdbc.sql(sql).param("a", a).param("b", b).query(Long.class).single();
  }

  public CustomerPage customers(String q, int limit, int offset) {
    String text = q == null ? "" : q.trim().toLowerCase();
    String like = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    String where = text.isEmpty() ? "" : " where lower(u.name) like :like escape '\\' or lower(u.email) like :like escape '\\'";
    String from = """
        from "User" u left join (
          select "userId", count(*) as cnt, sum(amount) as spent, max("paidAt") as last from "Order" where %s group by "userId"
        ) s on s."userId" = u.id
        """.formatted(SOLD);
    var count = jdbc.sql("select count(*) " + from + where);
    if (!text.isEmpty()) count = count.param("like", like);
    long total = count.query(Long.class).single();
    var rows = jdbc.sql("""
        select u.id, u.name, u.email, u."emailVerifiedAt" is not null as verified, u.role::text as role, u."createdAt",
               coalesce(s.cnt, 0) as orders, coalesce(s.spent, 0) as spent, s.last
        """ + from + where + " order by u.\"createdAt\" desc, u.id limit :limit offset :offset");
    if (!text.isEmpty()) rows = rows.param("like", like);
    List<Customer> items = rows.param("limit", limit).param("offset", offset)
        .query((rs, n) -> new Customer(rs.getString("id"), rs.getString("name"), rs.getString("email"), rs.getBoolean("verified"),
            rs.getString("role"), rs.getObject("createdAt", LocalDateTime.class), rs.getLong("orders"), rs.getLong("spent"),
            rs.getObject("last", LocalDateTime.class))).list();
    return new CustomerPage(total, items, (long) offset + items.size() < total);
  }
}
