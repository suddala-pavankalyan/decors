package com.decors.payments;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.AppUser;
import com.decors.domain.CartItem;
import com.decors.domain.OrderItem;
import com.decors.domain.OrderStatus;
import com.decors.domain.ShopOrder;
import com.decors.repo.Repositories.CartItemRepository;
import com.decors.service.AddressService;
import com.decors.service.CouponService;
import com.decors.service.PersonalizationService;
import com.decors.service.ShippingService;
import com.decors.service.StockMessages;
import com.decors.repo.Repositories.OrderItemRepository;
import com.decors.repo.Repositories.OrderRepository;
import com.decors.repo.Repositories.UserRepository;
import com.decors.web.dto.PaymentDtos;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrdersService {
  private final UserRepository users;
  private final CartItemRepository cart;
  private final OrderRepository orders;
  private final OrderItemRepository orderItems;
  private final RazorpayGateway gateway;
  private final JdbcClient jdbc;
  private final TransactionTemplate tx;
  private final OrderEvents events;
  private final CancellationService cancellation;
  private final AddressService addresses;
  private final CouponService coupons;
  private final ShippingService shipping;
  private final PersonalizationService personalization;

  public OrdersService(UserRepository users, CartItemRepository cart, OrderRepository orders, OrderItemRepository orderItems,
      RazorpayGateway gateway, JdbcClient jdbc, TransactionTemplate tx, OrderEvents events, CancellationService cancellation, AddressService addresses, CouponService coupons, ShippingService shipping, PersonalizationService personalization) {
    this.personalization = personalization;
    this.shipping = shipping;
    this.coupons = coupons;
    this.addresses = addresses;
    this.events = events;
    this.cancellation = cancellation;
    this.users = users;
    this.cart = cart;
    this.orders = orders;
    this.orderItems = orderItems;
    this.gateway = gateway;
    this.jdbc = jdbc;
    this.tx = tx;
  }

  /** Build an order from the user's saved cart, priced from the database (never from the client). */
  public Map<String, Object> checkout(AppUser current, PaymentDtos.Address addr) {
    AppUser user = users.findById(current.id).orElseThrow(ApiException::unauthorized);
    if (user.emailVerifiedAt == null) {
      throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN,
          "Please confirm your email address before checking out. You can request a new email from your profile.",
          Map.of("code", "EMAIL_NOT_VERIFIED"));
    }
    // Reject early when payments are not set up, before any order row is written.
    gateway.keyId();

    ShopOrder order = tx.execute(s -> {
      List<CartItem> lines = cart.findForUser(user.id);
      if (lines.isEmpty()) throw ApiException.badRequest("Your cart is empty");
      long total = 0;
      ShopOrder o = new ShopOrder();
      o.id = Ids.newId();
      o.userId = user.id;
      o.createdAt = Time.now();
      o.shipName = addr.name();
      o.shipPhone = addr.phone();
      o.shipLine1 = addr.line1();
      o.shipLine2 = addr.line2() == null || addr.line2().isEmpty() ? null : addr.line2();
      o.shipCity = addr.city();
      o.shipState = addr.state();
      o.shipPincode = addr.pincode();
      // Personalised products need their card details before anything is reserved or charged.
      Map<String, String> details = new HashMap<>();
      jdbc.sql("select \"productId\", personalization::text from \"CartItem\" where \"userId\" = :u and personalization is not null")
          .param("u", user.id).query((rs, n) -> Map.entry(rs.getString(1), rs.getString(2))).list().forEach(e -> details.put(e.getKey(), e.getValue()));
      LocalDate today = LocalDate.now(ShippingService.SHOP_ZONE);
      for (CartItem c : lines) {
        if (c.product.personalizable) personalization.requireUsable(c.product.name, details.get(c.product.id), today);
      }
      // Reserve the stock first (in a fixed order, so two checkouts never wait on each other). If any item has run
      // short the whole checkout is refused and nothing is kept.
      for (CartItem c : lines.stream().sorted(java.util.Comparator.comparing(l -> l.product.id)).toList()) {
        int reserved = jdbc.sql("update \"Product\" set stock = stock - :q where id = :id and stock >= :q")
            .param("q", c.qty).param("id", c.product.id).update();
        if (reserved == 0) {
          int left = jdbc.sql("select stock from \"Product\" where id = :id").param("id", c.product.id).query(Integer.class).optional().orElse(0);
          throw ApiException.conflict(StockMessages.shortage(c.product.name, left));
        }
      }
      List<OrderItem> items = new ArrayList<>();
      for (CartItem c : lines) {
        OrderItem i = new OrderItem();
        i.orderId = o.id;
        i.productId = c.product.id;
        i.name = c.product.name;
        i.unitPricePaise = c.product.price * 100;
        i.qty = c.qty;
        i.category = c.product.category;
        total += (long) i.unitPricePaise * i.qty;
        items.add(i);
      }
      o.subtotalPaise = Math.toIntExact(total);
      boolean freeShipping = false;
      if (addr.couponCode() != null && !addr.couponCode().isBlank()) {
        CouponService.Applied applied = coupons.apply(user.id, addr.couponCode(), o.subtotalPaise, true);
        o.couponId = applied.couponId();
        o.couponCode = applied.code();
        o.discountPaise = applied.discountPaise();
        freeShipping = applied.freeShipping();
      }
      ShippingService.Settings rules = shipping.settings();
      ShippingService.Delivery delivery = ShippingService.estimate(rules, addr.pincode(), LocalDate.now(ShippingService.SHOP_ZONE));
      if (!delivery.serviceable()) throw ApiException.badRequest("Sorry, we cannot deliver to this pincode yet");
      o.shippingPaise = ShippingService.fee(rules, o.subtotalPaise - o.discountPaise, freeShipping);
      o.estimatedFrom = delivery.from();
      o.estimatedTo = delivery.to();
      o.amount = o.subtotalPaise - o.discountPaise + o.shippingPaise;
      orders.saveAndFlush(o);
      orderItems.saveAll(items);
      for (OrderItem i : items) {
        String d = i.productId == null ? null : details.get(i.productId);
        if (d != null) {
          jdbc.sql("update \"OrderItem\" set personalization = cast(:d as jsonb) where id = :id").param("d", d).param("id", i.id).update();
        }
      }
      events.record(o.id, OrderStatus.PENDING, "Order placed");
      return o;
    });

    if (Boolean.TRUE.equals(addr.saveAddress())) {
      try {
        addresses.saveFromCheckout(user.id, addr);
      } catch (RuntimeException e) {
        // Remembering the address is a convenience; never let it block a purchase.
      }
    }
    String rzpId = gateway.createOrder(order.amount, order.id);
    jdbc.sql("update \"Order\" set \"razorpayOrderId\" = :r where id = :id").param("r", rzpId).param("id", order.id).update();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("orderId", order.id);
    out.put("razorpayOrderId", rzpId);
    out.put("amount", order.amount);
    out.put("currency", "INR");
    out.put("keyId", gateway.keyId());
    return out;
  }

  public record Preview(int subtotalPaise, int discountPaise, int shippingPaise, int totalPaise, String couponCode,
      boolean freeShipping, ShippingService.Delivery delivery) {}

  /** What checkout would charge right now for the saved cart, a coupon and a delivery pincode. Writes nothing. */
  public Preview preview(AppUser user, String pincode, String couponCode) {
    List<CartItem> lines = cart.findForUser(user.id);
    if (lines.isEmpty()) throw ApiException.badRequest("Your cart is empty");
    long subtotal = 0;
    for (CartItem c : lines) subtotal += (long) c.product.price * 100 * c.qty;
    int sub = Math.toIntExact(subtotal);
    int discount = 0;
    boolean freeShipping = false;
    String code = null;
    if (couponCode != null && !couponCode.isBlank()) {
      CouponService.Applied a = coupons.apply(user.id, couponCode, sub, false);
      discount = a.discountPaise();
      freeShipping = a.freeShipping();
      code = a.code();
    }
    ShippingService.Settings rules = shipping.settings();
    ShippingService.Delivery delivery = pincode == null || pincode.isBlank() ? null
        : ShippingService.estimate(rules, validPincode(pincode), LocalDate.now(ShippingService.SHOP_ZONE));
    int fee = ShippingService.fee(rules, sub - discount, freeShipping);
    return new Preview(sub, discount, fee, sub - discount + fee, code, freeShipping, delivery);
  }

  private static String validPincode(String p) {
    if (!ShippingService.validPincode(p)) throw ApiException.badRequest("Enter a 6-digit pincode");
    return p;
  }

  /** Called from the browser after Razorpay reports success. */
  public Map<String, Object> verify(AppUser user, PaymentDtos.Verify p) {
    ShopOrder order = orders.findByIdAndUserId(p.orderId(), user.id).orElse(null);
    if (order == null || order.razorpayOrderId == null || !order.razorpayOrderId.equals(p.razorpay_order_id())) {
      throw ApiException.notFound("Order not found");
    }
    if (!gateway.verifyPayment(p.razorpay_order_id(), p.razorpay_payment_id(), p.razorpay_signature())) {
      throw ApiException.badRequest("Payment verification failed");
    }
    markPaid(order.razorpayOrderId, p.razorpay_payment_id(), order.amount);
    return get(user, order.id);
  }

  /**
   * Idempotent: the browser callback and the webhook may both report the same payment. The amount must match what we
   * asked Razorpay to collect. The conditional update means only one of two concurrent callers wins.
   */
  public void markPaid(String razorpayOrderId, String paymentId, long paidAmount) {
    boolean refundLatePayment = Boolean.TRUE.equals(tx.execute(s -> {
      ShopOrder order = orders.findByRazorpayOrderId(razorpayOrderId).orElse(null);
      if (order == null || order.amount != paidAmount) return false;
      int changed = jdbc.sql("""
              update "Order" set status = 'PAID', "razorpayPaymentId" = :pay, "paidAt" = :t
              where id = :id and status = 'PENDING'
              """)
          .param("pay", paymentId).param("t", Time.now()).param("id", order.id).update();
      if (changed == 0) {
        // Paid after the customer had already cancelled: keep it cancelled and give the money back.
        int late = jdbc.sql("""
                update "Order" set "razorpayPaymentId" = :pay, "paidAt" = :t, "refundStatus" = 'PENDING'
                where id = :id and status = 'CANCELLED' and "razorpayPaymentId" is null
                """)
            .param("pay", paymentId).param("t", Time.now()).param("id", order.id).update();
        if (late == 1) events.record(order.id, OrderStatus.CANCELLED, "Payment arrived after cancellation; refunding it");
        return late == 1;
      }
      events.record(order.id, OrderStatus.PAID, "Payment received");
      // Remove what was bought from the cart; anything added since checkout started stays.
      jdbc.sql("""
              delete from "CartItem" where "userId" = :u
                and "productId" in (select "productId" from "OrderItem" where "orderId" = :o and "productId" is not null)
              """)
          .param("u", order.userId).param("o", order.id).update();
      return false;
    }));
    if (refundLatePayment) {
      orders.findByRazorpayOrderId(razorpayOrderId).ifPresent(o -> cancellation.attemptRefund(o.id));
    }
  }

  public List<Map<String, Object>> list(AppUser user) {
    return views(orders.findByUserIdOrderByCreatedAtDesc(user.id));
  }

  public Map<String, Object> get(AppUser user, String id) {
    ShopOrder o = orders.findByIdAndUserId(id, user.id).orElseThrow(() -> ApiException.notFound("Order not found"));
    return views(List.of(o)).get(0);
  }

  /** The JSON for orders: lines and timeline are loaded for all of them in two queries. */
  public List<Map<String, Object>> views(List<ShopOrder> found) {
    if (found.isEmpty()) return List.of();
    List<String> ids = found.stream().map(o -> o.id).toList();
    Map<String, List<OrderItem>> items = orderItems.findByOrderIdInOrderByIdAsc(ids)
        .stream().collect(Collectors.groupingBy(i -> i.orderId));
    Map<String, List<Map<String, Object>>> events = new HashMap<>();
    jdbc.sql("""
            select "orderId", status::text as status, note, "createdAt" from "OrderEvent"
            where "orderId" in (:ids) order by "createdAt", id
            """)
        .param("ids", ids)
        .query((rs, n) -> {
          Map<String, Object> e = new LinkedHashMap<>();
          e.put("status", rs.getString("status"));
          e.put("note", rs.getString("note"));
          e.put("createdAt", iso(rs.getObject("createdAt", LocalDateTime.class)));
          return Map.entry(rs.getString("orderId"), e);
        })
        .list()
        .forEach(en -> events.computeIfAbsent(en.getKey(), k -> new ArrayList<>()).add(en.getValue()));
    Map<Integer, com.fasterxml.jackson.databind.JsonNode> cards = new HashMap<>();
    jdbc.sql("select id, personalization::text from \"OrderItem\" where \"orderId\" in (:ids) and personalization is not null")
        .param("ids", ids).query((rs, n) -> Map.entry(rs.getInt(1), rs.getString(2))).list()
        .forEach(e -> cards.put(e.getKey(), personalization.read(e.getValue())));
    return found.stream().map(o -> view(o, items.getOrDefault(o.id, List.of()), events.getOrDefault(o.id, List.of()), cards)).toList();
  }

  private static Map<String, Object> view(ShopOrder o, List<OrderItem> items, List<Map<String, Object>> events,
      Map<Integer, com.fasterxml.jackson.databind.JsonNode> cards) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", o.id);
    m.put("userId", o.userId);
    m.put("status", o.status.name());
    m.put("amount", o.amount);
    m.put("subtotalPaise", o.subtotalPaise);
    m.put("discountPaise", o.discountPaise);
    m.put("shippingPaise", o.shippingPaise);
    m.put("estimatedFrom", o.estimatedFrom);
    m.put("estimatedTo", o.estimatedTo);
    m.put("couponCode", o.couponCode);
    m.put("currency", o.currency);
    m.put("razorpayOrderId", o.razorpayOrderId);
    m.put("razorpayPaymentId", o.razorpayPaymentId);
    m.put("shipName", o.shipName);
    m.put("shipPhone", o.shipPhone);
    m.put("shipLine1", o.shipLine1);
    m.put("shipLine2", o.shipLine2);
    m.put("shipCity", o.shipCity);
    m.put("shipState", o.shipState);
    m.put("shipPincode", o.shipPincode);
    m.put("createdAt", iso(o.createdAt));
    m.put("paidAt", iso(o.paidAt));
    m.put("carrier", o.carrier);
    m.put("trackingNumber", o.trackingNumber);
    m.put("cancelReason", o.cancelReason);
    m.put("refundStatus", o.refundStatus);
    m.put("refundedAt", iso(o.refundedAt));
    m.put("items", items.stream().map(i -> {
      Map<String, Object> im = new LinkedHashMap<>();
      im.put("id", i.id);
      im.put("orderId", i.orderId);
      im.put("productId", i.productId);
      im.put("name", i.name);
      im.put("unitPricePaise", i.unitPricePaise);
      im.put("qty", i.qty);
      im.put("personalization", cards.get(i.id));
      return im;
    }).toList());
    m.put("events", events);
    return m;
  }

  private static String iso(LocalDateTime t) {
    return t == null ? null : Time.ISO.format(t);
  }
}
