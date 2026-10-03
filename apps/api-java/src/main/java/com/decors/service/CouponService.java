package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.CartItem;
import com.decors.repo.Repositories.CartItemRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Discount codes. A code is checked against the cart on the server, both when the customer applies it and again at
 * checkout, so the client can never choose its own discount.
 */
@Service
public class CouponService {
  /** Razorpay cannot charge less than ₹1. */
  public static final int MIN_PAYABLE_PAISE = 100;
  /** An unpaid order keeps its coupon "in use" for this long, then the use is released. */
  static final long HOLD_MINUTES = 30;

  public record Applied(String couponId, String code, String description, int discountPaise) {}

  public record Quote(String code, String description, int subtotalPaise, int discountPaise, int totalPaise) {}

  private final JdbcClient jdbc;
  private final CartItemRepository cart;

  public CouponService(JdbcClient jdbc, CartItemRepository cart) {
    this.jdbc = jdbc;
    this.cart = cart;
  }

  /** What the code takes off a cart worth {@code subtotalPaise}. Never leaves less than ₹1 to pay. */
  public static int discount(String type, int value, Integer maxDiscountPaise, int subtotalPaise) {
    long d = "PERCENT".equals(type) ? (long) subtotalPaise * value / 100 : value;
    if (maxDiscountPaise != null) d = Math.min(d, maxDiscountPaise);
    d = Math.min(d, Math.max(0, subtotalPaise - MIN_PAYABLE_PAISE));
    return (int) Math.max(0, d);
  }

  static String rupees(int paise) {
    return paise % 100 == 0 ? "₹" + paise / 100 : String.format("₹%.2f", paise / 100.0);
  }

  private record Row(String id, String code, String description, String type, int value, Integer maxDiscountPaise,
      int minOrderPaise, LocalDateTime startsAt, LocalDateTime expiresAt, Integer usageLimit, Integer perUserLimit, boolean active) {}

  private static final String COLS = "id, code, description, type, value, \"maxDiscountPaise\", \"minOrderPaise\", \"startsAt\", \"expiresAt\", \"usageLimit\", \"perUserLimit\", active";

  private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new Row(rs.getString("id"), rs.getString("code"), rs.getString("description"), rs.getString("type"), rs.getInt("value"),
        (Integer) rs.getObject("maxDiscountPaise"), rs.getInt("minOrderPaise"), rs.getObject("startsAt", LocalDateTime.class),
        rs.getObject("expiresAt", LocalDateTime.class), (Integer) rs.getObject("usageLimit"), (Integer) rs.getObject("perUserLimit"),
        rs.getBoolean("active"));
  }

  /** Uses so far: every order that has not been cancelled and is not an abandoned, unpaid one. */
  private long uses(String couponId, String userId) {
    String sql = """
        select count(*) from "Order" where "couponId" = :c and status <> 'CANCELLED'
          and not (status = 'PENDING' and "createdAt" < :cutoff)
        """ + (userId == null ? "" : " and \"userId\" = :u");
    var q = jdbc.sql(sql).param("c", couponId).param("cutoff", Time.now().minusMinutes(HOLD_MINUTES));
    if (userId != null) q = q.param("u", userId);
    return q.query(Long.class).single();
  }

  /**
   * Checks the code for this customer and cart and returns what it is worth. Call inside the checkout transaction with
   * {@code lock = true}: that serialises people redeeming the same code, so a usage limit cannot be overshot.
   */
  public Applied apply(String userId, String rawCode, int subtotalPaise, boolean lock) {
    String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
    Row c = jdbc.sql("select " + COLS + " from \"Coupon\" where code = :code").param("code", code)
        .query((rs, n) -> row(rs)).optional().orElseThrow(() -> ApiException.badRequest("This coupon code is not valid"));
    if (!c.active()) throw ApiException.badRequest("This coupon code is not valid");
    if (lock) jdbc.sql("select 1 from (select pg_advisory_xact_lock(hashtext(:id))) t").param("id", c.id()).query(Integer.class).optional();
    LocalDateTime now = Time.now();
    if (c.startsAt() != null && c.startsAt().isAfter(now)) throw ApiException.badRequest("This coupon is not active yet");
    if (c.expiresAt() != null && !c.expiresAt().isAfter(now)) throw ApiException.badRequest("This coupon has expired");
    if (subtotalPaise < c.minOrderPaise()) {
      throw ApiException.badRequest("Add " + rupees(c.minOrderPaise() - subtotalPaise) + " more to use this coupon");
    }
    if (c.usageLimit() != null && uses(c.id(), null) >= c.usageLimit()) throw ApiException.badRequest("This coupon has been fully redeemed");
    if (c.perUserLimit() != null && uses(c.id(), userId) >= c.perUserLimit()) throw ApiException.badRequest("You have already used this coupon");
    int off = discount(c.type(), c.value(), c.maxDiscountPaise(), subtotalPaise);
    if (off <= 0) throw ApiException.badRequest("This coupon does not apply to your cart");
    return new Applied(c.id(), c.code(), c.description(), off);
  }

  /** What the customer sees when they press "Apply": the code checked against their saved cart. */
  @Transactional(readOnly = true)
  public Quote quote(String userId, String code) {
    List<CartItem> lines = cart.findForUser(userId);
    if (lines.isEmpty()) throw ApiException.badRequest("Your cart is empty");
    int subtotal = 0;
    for (CartItem l : lines) subtotal += l.product.price * 100 * l.qty;
    Applied a = apply(userId, code, subtotal, false);
    return new Quote(a.code(), a.description(), subtotal, a.discountPaise(), subtotal - a.discountPaise());
  }

  // ───────────── admin ─────────────

  public record CouponView(String id, String code, String description, String type, int value, Integer maxDiscountPaise,
      int minOrderPaise, LocalDateTime startsAt, LocalDateTime expiresAt, Integer usageLimit, Integer perUserLimit,
      boolean active, long redemptions, String state, LocalDateTime createdAt) {}

  public record Input(String code, String description, String type, int value, Integer maxDiscountPaise, Integer minOrderPaise,
      LocalDateTime startsAt, LocalDateTime expiresAt, Integer usageLimit, Integer perUserLimit, Boolean active) {}

  private CouponView view(Row r, LocalDateTime createdAt) {
    long used = uses(r.id(), null);
    LocalDateTime now = Time.now();
    String state = !r.active() ? "INACTIVE"
        : r.expiresAt() != null && !r.expiresAt().isAfter(now) ? "EXPIRED"
        : r.startsAt() != null && r.startsAt().isAfter(now) ? "SCHEDULED"
        : r.usageLimit() != null && used >= r.usageLimit() ? "EXHAUSTED" : "ACTIVE";
    return new CouponView(r.id(), r.code(), r.description(), r.type(), r.value(), r.maxDiscountPaise(), r.minOrderPaise(),
        r.startsAt(), r.expiresAt(), r.usageLimit(), r.perUserLimit(), r.active(), used, state, createdAt);
  }

  @Transactional(readOnly = true)
  public List<CouponView> list() {
    return jdbc.sql("select " + COLS + ", \"createdAt\" from \"Coupon\" order by \"createdAt\" desc, id")
        .query((rs, n) -> view(row(rs), rs.getObject("createdAt", LocalDateTime.class))).list();
  }

  @Transactional(readOnly = true)
  public CouponView get(String id) {
    return jdbc.sql("select " + COLS + ", \"createdAt\" from \"Coupon\" where id = :id").param("id", id)
        .query((rs, n) -> view(row(rs), rs.getObject("createdAt", LocalDateTime.class))).optional()
        .orElseThrow(() -> ApiException.notFound("Coupon not found"));
  }

  private static void check(Input in) {
    if (in.value() < 1) throw ApiException.badRequest("value must not be less than 1");
    if ("PERCENT".equals(in.type()) && in.value() > 100) throw ApiException.badRequest("A percentage coupon cannot take off more than 100%");
    if (!"PERCENT".equals(in.type()) && in.maxDiscountPaise() != null) throw ApiException.badRequest("maxDiscountPaise only applies to percentage coupons");
    if (in.startsAt() != null && in.expiresAt() != null && !in.expiresAt().isAfter(in.startsAt())) {
      throw ApiException.badRequest("The expiry must be after the start");
    }
  }

  @Transactional
  public CouponView create(Input in) {
    check(in);
    String id = Ids.newId();
    try {
      write("""
          insert into "Coupon" (id, code, description, type, value, "maxDiscountPaise", "minOrderPaise", "startsAt", "expiresAt", "usageLimit", "perUserLimit", active)
          values (:id, :code, :desc, :type, :value, :max, :min, :starts, :expires, :ulimit, :plimit, :active)
          """, id, in);
    } catch (DuplicateKeyException e) {
      throw ApiException.conflict("A coupon with this code already exists");
    }
    return get(id);
  }

  @Transactional
  public CouponView update(String id, Input in) {
    check(in);
    get(id);
    try {
      write("""
          update "Coupon" set code = :code, description = :desc, type = :type, value = :value, "maxDiscountPaise" = :max,
                 "minOrderPaise" = :min, "startsAt" = :starts, "expiresAt" = :expires, "usageLimit" = :ulimit,
                 "perUserLimit" = :plimit, active = :active
          where id = :id
          """, id, in);
    } catch (DuplicateKeyException e) {
      throw ApiException.conflict("A coupon with this code already exists");
    }
    return get(id);
  }

  private void write(String sql, String id, Input in) {
    jdbc.sql(sql).param("id", id).param("code", in.code()).param("desc", in.description() == null || in.description().isBlank() ? null : in.description().trim())
        .param("type", in.type()).param("value", in.value()).param("max", in.maxDiscountPaise())
        .param("min", in.minOrderPaise() == null ? 0 : in.minOrderPaise()).param("starts", in.startsAt()).param("expires", in.expiresAt())
        .param("ulimit", in.usageLimit()).param("plimit", in.perUserLimit()).param("active", in.active() == null || in.active()).update();
  }

  /** Codes that were never used can be deleted; used ones are kept for the records and can be switched off instead. */
  @Transactional
  public void delete(String id) {
    get(id);
    long ever = jdbc.sql("select count(*) from \"Order\" where \"couponId\" = :id").param("id", id).query(Long.class).single();
    if (ever > 0) throw ApiException.conflict("This coupon has been used on orders, so it cannot be deleted. Switch it off instead.");
    jdbc.sql("delete from \"Coupon\" where id = :id").param("id", id).update();
  }
}
