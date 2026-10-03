package com.decors.payments;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.AppUser;
import com.decors.domain.CartItem;
import com.decors.domain.OrderItem;
import com.decors.domain.ShopOrder;
import com.decors.repo.Repositories.CartItemRepository;
import com.decors.repo.Repositories.OrderItemRepository;
import com.decors.repo.Repositories.OrderRepository;
import com.decors.repo.Repositories.UserRepository;
import com.decors.web.dto.PaymentDtos;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

  public OrdersService(UserRepository users, CartItemRepository cart, OrderRepository orders, OrderItemRepository orderItems,
      RazorpayGateway gateway, JdbcClient jdbc, TransactionTemplate tx) {
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
      List<OrderItem> items = new ArrayList<>();
      for (CartItem c : lines) {
        OrderItem i = new OrderItem();
        i.orderId = o.id;
        i.productId = c.product.id;
        i.name = c.product.name;
        i.unitPricePaise = c.product.price * 100;
        i.qty = c.qty;
        total += (long) i.unitPricePaise * i.qty;
        items.add(i);
      }
      o.amount = Math.toIntExact(total);
      orders.saveAndFlush(o);
      orderItems.saveAll(items);
      return o;
    });

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
    tx.executeWithoutResult(s -> {
      ShopOrder order = orders.findByRazorpayOrderId(razorpayOrderId).orElse(null);
      if (order == null || order.amount != paidAmount) return;
      int changed = jdbc.sql("""
              update "Order" set status = 'PAID', "razorpayPaymentId" = :pay, "paidAt" = :t
              where id = :id and status <> 'PAID'
              """)
          .param("pay", paymentId).param("t", Time.now()).param("id", order.id).update();
      if (changed == 0) return;
      // Remove what was bought from the cart; anything added since checkout started stays.
      jdbc.sql("""
              delete from "CartItem" where "userId" = :u
                and "productId" in (select "productId" from "OrderItem" where "orderId" = :o and "productId" is not null)
              """)
          .param("u", order.userId).param("o", order.id).update();
    });
  }

  public List<Map<String, Object>> list(AppUser user) {
    List<ShopOrder> found = orders.findByUserIdOrderByCreatedAtDesc(user.id);
    if (found.isEmpty()) return List.of();
    Map<String, List<OrderItem>> items = orderItems.findByOrderIdInOrderByIdAsc(found.stream().map(o -> o.id).toList())
        .stream().collect(Collectors.groupingBy(i -> i.orderId));
    return found.stream().map(o -> view(o, items.getOrDefault(o.id, List.of()))).toList();
  }

  public Map<String, Object> get(AppUser user, String id) {
    ShopOrder o = orders.findByIdAndUserId(id, user.id).orElseThrow(() -> ApiException.notFound("Order not found"));
    return view(o, orderItems.findByOrderIdInOrderByIdAsc(List.of(o.id)));
  }

  private static Map<String, Object> view(ShopOrder o, List<OrderItem> items) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", o.id);
    m.put("userId", o.userId);
    m.put("status", o.status.name());
    m.put("amount", o.amount);
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
    m.put("items", items.stream().map(i -> {
      Map<String, Object> im = new LinkedHashMap<>();
      im.put("id", i.id);
      im.put("orderId", i.orderId);
      im.put("productId", i.productId);
      im.put("name", i.name);
      im.put("unitPricePaise", i.unitPricePaise);
      im.put("qty", i.qty);
      return im;
    }).toList());
    return m;
  }

  private static String iso(LocalDateTime t) {
    return t == null ? null : Time.ISO.format(t);
  }
}
