package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CouponMathTest {
  @Test
  void percentageIsRoundedDownInPaise() {
    assertEquals(1000, CouponService.discount("PERCENT", 10, null, 10000));
    assertEquals(333, CouponService.discount("PERCENT", 10, null, 3333)); // 333.3 → 333
  }

  @Test
  void percentageHonoursTheCap() {
    assertEquals(500, CouponService.discount("PERCENT", 50, 500, 10000));
    assertEquals(200, CouponService.discount("PERCENT", 10, 500, 2000));
  }

  @Test
  void flatAmountIsTakenOff() {
    assertEquals(2500, CouponService.discount("FLAT", 2500, null, 10000));
  }

  @Test
  void neverLeavesLessThanOneRupeeToPay() {
    assertEquals(9900, CouponService.discount("FLAT", 50000, null, 10000));
    assertEquals(9900, CouponService.discount("PERCENT", 100, null, 10000));
    assertEquals(0, CouponService.discount("FLAT", 500, null, 100));
  }

  @Test
  void formatsRupees() {
    assertEquals("₹50", CouponService.rupees(5000));
    assertEquals("₹12.50", CouponService.rupees(1250));
  }
}
