package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ShippingTest {
  private static final ShippingService.Settings RULES = new ShippingService.Settings(4900, 99900, "560001", 1, List.of("19"));

  @Test
  void feeIsWaivedAboveTheThresholdOrByACoupon() {
    assertEquals(4900, ShippingService.fee(RULES, 50000, false));
    assertEquals(0, ShippingService.fee(RULES, 99900, false));
    assertEquals(0, ShippingService.fee(RULES, 100, true));
    var never = new ShippingService.Settings(4900, null, "560001", 1, List.of());
    assertEquals(4900, ShippingService.fee(never, 10_000_000, false));
  }

  @Test
  void transitDaysDependOnDistanceFromTheShop() {
    assertArrayEquals(new int[] {1, 2}, ShippingService.transitDays("560001", "560034"));
    assertArrayEquals(new int[] {2, 4}, ShippingService.transitDays("560001", "575001"));
    assertArrayEquals(new int[] {4, 7}, ShippingService.transitDays("560001", "110001"));
  }

  @Test
  void estimateAddsHandlingDays() {
    var d = ShippingService.estimate(RULES, "110001", LocalDate.of(2026, 10, 1));
    assertTrue(d.serviceable());
    assertEquals(5, d.minDays());
    assertEquals(8, d.maxDays());
    assertEquals(LocalDate.of(2026, 10, 6), d.from());
    assertEquals(LocalDate.of(2026, 10, 9), d.to());
  }

  @Test
  void blockedPrefixesAreNotServiceable() {
    var d = ShippingService.estimate(RULES, "194101", LocalDate.of(2026, 10, 1));
    assertFalse(d.serviceable());
    assertEquals(null, d.from());
  }

  @Test
  void pincodesMustBeSixDigitsNotStartingWithZero() {
    assertTrue(ShippingService.validPincode("560001"));
    assertFalse(ShippingService.validPincode("060001"));
    assertFalse(ShippingService.validPincode("56001"));
    assertFalse(ShippingService.validPincode("56000a"));
    assertFalse(ShippingService.validPincode(null));
  }

  @Test
  void parsesTheBlockedList() {
    assertEquals(List.of("19", "79"), ShippingService.prefixes(" 19, 79 ,"));
    assertEquals(List.of(), ShippingService.prefixes(""));
  }
}
