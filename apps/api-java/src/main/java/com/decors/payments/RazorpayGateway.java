package com.decors.payments;

import com.decors.common.ApiException;
import com.decors.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Thin wrapper around Razorpay's REST API so the rest of the app (and tests) never touch HTTP or secrets directly. */
@Component
public class RazorpayGateway {
  private static final Logger log = LoggerFactory.getLogger(RazorpayGateway.class);

  private final AppProperties.Razorpay cfg;
  private final ObjectMapper json;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

  public RazorpayGateway(AppProperties props, ObjectMapper json) {
    this.cfg = props.razorpay();
    this.json = json;
  }

  private static String required(String v) {
    if (v == null || v.isBlank()) throw ApiException.unavailable("Payments are not configured");
    return v;
  }

  public String keyId() {
    return required(cfg.keyId());
  }

  /** Creates a Razorpay order for the amount (in paise) and returns its id. */
  public String createOrder(int amountPaise, String receipt) {
    String key = keyId();
    String secret = required(cfg.keySecret());
    try {
      String body = json.writeValueAsString(Map.of("amount", amountPaise, "currency", "INR", "receipt", receipt));
      String auth = Base64.getEncoder().encodeToString((key + ":" + secret).getBytes(StandardCharsets.UTF_8));
      HttpRequest req = HttpRequest.newBuilder(URI.create(cfg.baseUrl().replaceAll("/+$", "") + "/v1/orders"))
          .timeout(Duration.ofSeconds(20))
          .header("Authorization", "Basic " + auth)
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();
      HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() / 100 != 2) {
        // Razorpay errors carry a description; log it without echoing credentials.
        String description = "HTTP " + res.statusCode();
        try {
          JsonNode d = json.readTree(res.body()).path("error").path("description");
          if (d.isTextual()) description = d.asText();
        } catch (IOException ignored) {
          // keep the status code
        }
        log.error("Razorpay order creation failed: {}", description);
        throw ApiException.badGateway("Could not start the payment. Please try again.");
      }
      JsonNode id = json.readTree(res.body()).path("id");
      if (!id.isTextual()) throw new IOException("response had no order id");
      return id.asText();
    } catch (ApiException e) {
      throw e;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw ApiException.badGateway("Could not start the payment. Please try again.");
    } catch (IOException e) {
      log.error("Razorpay order creation failed: {}", e.getMessage());
      throw ApiException.badGateway("Could not start the payment. Please try again.");
    }
  }

  /** Checkout success callback: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
  public boolean verifyPayment(String razorpayOrderId, String paymentId, String signature) {
    return safeEqual(hmac(required(cfg.keySecret()), (razorpayOrderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8)), signature);
  }

  /** Webhook: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook_secret). */
  public boolean verifyWebhook(byte[] rawBody, String signature) {
    return safeEqual(hmac(required(cfg.webhookSecret()), rawBody), signature);
  }

  static String hmac(String secret, byte[] data) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(data));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  static boolean safeEqual(String a, String b) {
    return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
  }
}
