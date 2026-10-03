package com.decors.web;

import com.decors.admin.DashboardService;
import com.decors.common.ApiException;
import com.decors.security.AdminOnly;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin")
@AdminOnly
public class AdminDashboardController {
  private final DashboardService dashboard;

  public AdminDashboardController(DashboardService dashboard) {
    this.dashboard = dashboard;
  }

  @GetMapping("/dashboard")
  public DashboardService.Dashboard dashboard(@RequestParam(defaultValue = "30") int days) {
    return dashboard.dashboard(days);
  }

  @GetMapping("/customers")
  public DashboardService.CustomerPage customers(@RequestParam(required = false) String q, @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    if (q != null && q.trim().length() > 100) throw ApiException.badRequest("q must be shorter than or equal to 100 characters");
    if (limit != null && (limit < 1 || limit > 100)) throw ApiException.badRequest(limit < 1 ? "limit must not be less than 1" : "limit must not be greater than 100");
    if (offset != null && (offset < 0 || offset > 100000)) throw ApiException.badRequest(offset < 0 ? "offset must not be less than 0" : "offset must not be greater than 100000");
    return dashboard.customers(q, limit == null ? 30 : limit, offset == null ? 0 : offset);
  }
}
