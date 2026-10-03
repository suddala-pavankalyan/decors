package com.decors.service;

import com.decors.common.ApiException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Shipping fee, free-shipping threshold, serviceable pincodes and delivery estimates. */
@Service
public class ShippingService {
  /** Dates are shown to customers in India. */
  public static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");

  public record Settings(int baseFeePaise, Integer freeAbovePaise, String originPincode, int handlingDays, List<String> blockedPrefixes) {}

  public record Delivery(boolean serviceable, String pincode, Integer minDays, Integer maxDays, LocalDate from, LocalDate to,
      int feePaise, Integer freeAbovePaise) {}

  private final JdbcClient jdbc;

  public ShippingService(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public Settings settings() {
    return jdbc.sql("select \"baseFeePaise\", \"freeAbovePaise\", \"originPincode\", \"handlingDays\", \"blockedPrefixes\" from \"ShippingSetting\" where id = 1")
        .query((rs, n) -> new Settings(rs.getInt(1), (Integer) rs.getObject(2), rs.getString(3), rs.getInt(4), prefixes(rs.getString(5))))
        .single();
  }

  @Transactional
  public Settings update(Settings s) {
    jdbc.sql("""
            update "ShippingSetting" set "baseFeePaise" = :fee, "freeAbovePaise" = :free, "originPincode" = :origin,
                   "handlingDays" = :days, "blockedPrefixes" = :blocked where id = 1
            """)
        .param("fee", s.baseFeePaise()).param("free", s.freeAbovePaise()).param("origin", s.originPincode())
        .param("days", s.handlingDays()).param("blocked", String.join(",", s.blockedPrefixes())).update();
    return settings();
  }

  static List<String> prefixes(String csv) {
    return csv == null || csv.isBlank() ? List.of() : Arrays.stream(csv.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
  }

  public static boolean validPincode(String p) {
    return p != null && p.matches("[1-9][0-9]{5}");
  }

  /** Days in transit: the same area as the shop is quickest, then the same region, then the rest of the country. */
  static int[] transitDays(String origin, String destination) {
    if (origin.regionMatches(0, destination, 0, 3)) return new int[] {1, 2};
    if (origin.charAt(0) == destination.charAt(0)) return new int[] {2, 4};
    return new int[] {4, 7};
  }

  /** The fee for items worth {@code itemsPaise} after any discount. A free-shipping coupon waives it. */
  public static int fee(Settings s, int itemsPaise, boolean freeShippingCoupon) {
    if (freeShippingCoupon) return 0;
    if (s.freeAbovePaise() != null && itemsPaise >= s.freeAbovePaise()) return 0;
    return s.baseFeePaise();
  }

  public static Delivery estimate(Settings s, String pincode, LocalDate today) {
    boolean blocked = s.blockedPrefixes().stream().anyMatch(pincode::startsWith);
    if (blocked) return new Delivery(false, pincode, null, null, null, null, s.baseFeePaise(), s.freeAbovePaise());
    int[] t = transitDays(s.originPincode(), pincode);
    return new Delivery(true, pincode, t[0] + s.handlingDays(), t[1] + s.handlingDays(),
        today.plusDays(t[0] + s.handlingDays()), today.plusDays(t[1] + s.handlingDays()), s.baseFeePaise(), s.freeAbovePaise());
  }

  public Delivery estimate(String pincode) {
    if (!validPincode(pincode)) throw ApiException.badRequest("Enter a 6-digit pincode");
    return estimate(settings(), pincode, LocalDate.now(SHOP_ZONE));
  }
}
