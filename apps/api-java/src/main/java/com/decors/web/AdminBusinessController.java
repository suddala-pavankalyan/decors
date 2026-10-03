package com.decors.web;

import com.decors.common.ApiException;
import com.decors.domain.Category;
import com.decors.invoice.BusinessService;
import com.decors.security.AdminOnly;
import com.decors.web.dto.AdminDtos;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/business")
@AdminOnly
public class AdminBusinessController {
  private final BusinessService business;

  public AdminBusinessController(BusinessService business) {
    this.business = business;
  }

  @GetMapping
  public BusinessService.Settings get() {
    return business.settings();
  }

  @PutMapping
  public BusinessService.Settings update(@Valid @RequestBody AdminDtos.BusinessInput in) {
    boolean registered = in.gstin() != null && !in.gstin().isBlank();
    if (registered && !in.gstin().startsWith(in.stateCode())) {
      throw ApiException.badRequest("The first two digits of the GSTIN (" + in.gstin().substring(0, 2) + ") must match the state code");
    }
    Map<String, BusinessService.RateRow> rates = new LinkedHashMap<>();
    for (var e : in.rates().entrySet()) {
      if (Category.fromSlug(e.getKey()).isEmpty()) {
        throw ApiException.badRequest("rates has an unknown category: " + e.getKey() + " (use " + String.join(", ", Category.slugs()) + ")");
      }
      rates.put(e.getKey(), new BusinessService.RateRow(e.getValue().ratePercent(), e.getValue().hsn()));
    }
    return business.update(new BusinessService.Business(in.legalName(), in.addressLines(), registered ? in.gstin() : null, in.stateName(),
        in.stateCode(), in.contactEmail(), in.invoicePrefix(), in.shippingGstPercent()), rates);
  }
}
