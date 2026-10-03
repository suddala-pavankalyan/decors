package com.decors.web;

import com.decors.security.AdminOnly;
import com.decors.security.RateLimit;
import com.decors.service.ShippingService;
import com.decors.web.dto.AdminDtos;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class ShippingController {
  private final ShippingService shipping;

  public ShippingController(ShippingService shipping) {
    this.shipping = shipping;
  }

  /** "Check delivery" on product pages: can we deliver to this pincode, when, and what does shipping cost. */
  @GetMapping("/shipping/estimate") @RateLimit(limit = 60)
  public ShippingService.Delivery estimate(@RequestParam String pincode) {
    return shipping.estimate(pincode);
  }

  @GetMapping("/admin/shipping") @AdminOnly
  public ShippingService.Settings settings() {
    return shipping.settings();
  }

  @PutMapping("/admin/shipping") @AdminOnly
  public ShippingService.Settings update(@Valid @RequestBody AdminDtos.ShippingInput dto) {
    return shipping.update(new ShippingService.Settings(dto.baseFeePaise(), dto.freeAbovePaise(), dto.originPincode(),
        dto.handlingDays(), dto.blockedPrefixes().stream().distinct().toList()));
  }
}
