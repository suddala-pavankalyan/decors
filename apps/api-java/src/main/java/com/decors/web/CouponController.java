package com.decors.web;

import com.decors.domain.AppUser;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.security.RateLimit;
import com.decors.service.CouponService;
import com.decors.web.dto.PaymentDtos;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/coupons")
public class CouponController {
  private final CouponService coupons;

  public CouponController(CouponService coupons) {
    this.coupons = coupons;
  }

  /** "Apply" button: what this code is worth on the customer's saved cart. Limited, so codes cannot be guessed in bulk. */
  @PostMapping("/validate") @Authenticated @RateLimit(limit = 20)
  public CouponService.Quote validate(@CurrentUser AppUser user, @Valid @RequestBody PaymentDtos.ApplyCoupon dto) {
    return coupons.quote(user.id, dto.code());
  }
}
