package com.decors.web;

import com.decors.security.AdminOnly;
import com.decors.service.CouponService;
import com.decors.web.dto.AdminDtos;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/coupons")
@AdminOnly
public class AdminCouponsController {
  private final CouponService coupons;

  public AdminCouponsController(CouponService coupons) {
    this.coupons = coupons;
  }

  private static LocalDateTime utc(Instant i) {
    return i == null ? null : LocalDateTime.ofInstant(i, ZoneOffset.UTC).withNano(i.getNano() / 1_000_000 * 1_000_000);
  }

  private static CouponService.Input input(AdminDtos.CouponInput d) {
    return new CouponService.Input(d.code(), d.description(), d.type(), d.value() == null ? 0 : d.value(), d.maxDiscountPaise(), d.minOrderPaise(),
        utc(d.startsAt()), utc(d.expiresAt()), d.usageLimit(), d.perUserLimit(), d.active());
  }

  @GetMapping
  public List<CouponService.CouponView> list() {
    return coupons.list();
  }

  @GetMapping("/{id}")
  public CouponService.CouponView get(@PathVariable String id) {
    return coupons.get(id);
  }

  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public CouponService.CouponView create(@Valid @RequestBody AdminDtos.CouponInput dto) {
    return coupons.create(input(dto));
  }

  @PutMapping("/{id}")
  public CouponService.CouponView update(@PathVariable String id, @Valid @RequestBody AdminDtos.CouponInput dto) {
    return coupons.update(id, input(dto));
  }

  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String id) {
    coupons.delete(id);
  }
}
