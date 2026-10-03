package com.decors.web;

import com.decors.common.ApiException;
import com.decors.domain.AppUser;
import com.decors.payments.CancellationService;
import com.decors.payments.OrdersService;
import com.decors.payments.RazorpayGateway;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.security.RateLimit;
import com.decors.web.dto.PaymentDtos;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
public class PaymentsController {
  private final OrdersService orders;
  private final RazorpayGateway gateway;
  private final ObjectMapper json;
  private final CancellationService cancellation;

  public PaymentsController(OrdersService orders, RazorpayGateway gateway, ObjectMapper json, CancellationService cancellation) {
    this.cancellation = cancellation;
    this.orders = orders;
    this.gateway = gateway;
    this.json = json;
  }

  @PostMapping("/checkout") @Authenticated @RateLimit(limit = 10)
  public Map<String, Object> checkout(@CurrentUser AppUser user, @Valid @RequestBody PaymentDtos.Address address) {
    return orders.checkout(user, address);
  }

  @PostMapping("/checkout/verify") @Authenticated @RateLimit(limit = 20)
  public Map<String, Object> verify(@CurrentUser AppUser user, @Valid @RequestBody PaymentDtos.Verify dto) {
    return orders.verify(user, dto);
  }

  @GetMapping("/orders") @Authenticated
  public List<Map<String, Object>> list(@CurrentUser AppUser user) {
    return orders.list(user);
  }

  @PostMapping("/orders/{id}/cancel") @Authenticated @RateLimit(limit = 10)
  public Map<String, Object> cancel(@CurrentUser AppUser user, @PathVariable String id,
      @Valid @RequestBody(required = false) PaymentDtos.Cancel dto) {
    orders.get(user, id); // 404 unless it is the caller's own order
    cancellation.cancel(id, "you", dto == null ? null : dto.reason());
    return orders.get(user, id);
  }

  @GetMapping("/orders/{id}") @Authenticated
  public Map<String, Object> one(@CurrentUser AppUser user, @PathVariable String id) {
    return orders.get(user, id);
  }

  /** Razorpay server-to-server notification; authenticated by signature, not by cookie. */
  @PostMapping("/webhooks/razorpay")
  public Map<String, Object> webhook(@RequestBody(required = false) byte[] raw,
      @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) throws IOException {
    if (raw == null || raw.length == 0 || signature == null || !gateway.verifyWebhook(raw, signature)) {
      throw ApiException.unauthorized("Bad signature");
    }
    JsonNode event = json.readTree(raw);
    String type = event.path("event").asText("");
    if (type.equals("order.paid") || type.equals("payment.captured")) {
      JsonNode pay = event.path("payload").path("payment").path("entity");
      if (!pay.path("order_id").isTextual() || !pay.path("id").isTextual() || !pay.path("amount").isNumber()) {
        throw ApiException.badRequest("Malformed event");
      }
      orders.markPaid(pay.path("order_id").asText(), pay.path("id").asText(), pay.path("amount").asLong());
    }
    return Map.of("received", true);
  }
}
