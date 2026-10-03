package com.decors.web;

import com.decors.common.ApiException;
import com.decors.payments.AdminOrdersService;
import com.decors.security.AdminOnly;
import com.decors.web.dto.AdminDtos;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/orders")
@AdminOnly
public class AdminOrdersController {
  private final AdminOrdersService service;

  public AdminOrdersController(AdminOrdersService service) {
    this.service = service;
  }

  @GetMapping
  public AdminOrdersService.OrderPage list(@RequestParam(required = false) String status, @RequestParam(required = false) String q,
      @RequestParam(required = false) Integer limit, @RequestParam(required = false) Integer offset) {
    if (q != null && q.trim().length() > 100) throw ApiException.badRequest("q must be shorter than or equal to 100 characters");
    if (limit != null && (limit < 1 || limit > 100)) throw ApiException.badRequest(limit < 1 ? "limit must not be less than 1" : "limit must not be greater than 100");
    if (offset != null && (offset < 0 || offset > 100000)) throw ApiException.badRequest(offset < 0 ? "offset must not be less than 0" : "offset must not be greater than 100000");
    return service.list(status, q, limit == null ? 30 : limit, offset == null ? 0 : offset);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(@PathVariable String id) {
    return service.get(id);
  }

  @PostMapping("/{id}/status")
  public Map<String, Object> advance(@PathVariable String id, @Valid @RequestBody AdminDtos.OrderStep dto) {
    return service.advance(id, dto.status(), dto.carrier(), dto.trackingNumber());
  }
}
