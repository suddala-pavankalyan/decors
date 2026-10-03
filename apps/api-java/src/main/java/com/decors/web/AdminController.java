package com.decors.web;

import com.decors.common.ApiException;
import com.decors.security.AdminOnly;
import com.decors.security.RateLimit;
import com.decors.service.AdminService;
import com.decors.web.dto.AdminDtos;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/admin/products")
@AdminOnly
public class AdminController {
  private final AdminService admin;

  public AdminController(AdminService admin) {
    this.admin = admin;
  }

  @GetMapping
  public AdminService.AdminPage list(@RequestParam(required = false) String q, @RequestParam(required = false) String stock,
      @RequestParam(required = false) Integer limit, @RequestParam(required = false) Integer offset) {
    if (q != null && q.trim().length() > 100) throw ApiException.badRequest("q must be shorter than or equal to 100 characters");
    if (limit != null && limit < 1) throw ApiException.badRequest("limit must not be less than 1");
    if (limit != null && limit > 100) throw ApiException.badRequest("limit must not be greater than 100");
    if (offset != null && offset < 0) throw ApiException.badRequest("offset must not be less than 0");
    if (offset != null && offset > 100000) throw ApiException.badRequest("offset must not be greater than 100000");
    if (stock != null && !stock.isEmpty() && !stock.equals("low") && !stock.equals("out")) throw ApiException.badRequest("stock must be low or out");
    return admin.list(q, stock, limit, offset);
  }

  @GetMapping("/{id}")
  public AdminService.AdminProduct get(@PathVariable String id) {
    return admin.get(id);
  }

  @PostMapping @ResponseStatus(HttpStatus.CREATED)
  public AdminService.AdminProduct create(@Valid @RequestBody AdminDtos.ProductInput dto) {
    return admin.create(dto);
  }

  @PutMapping("/{id}")
  public AdminService.AdminProduct update(@PathVariable String id, @Valid @RequestBody AdminDtos.ProductInput dto) {
    return admin.update(id, dto);
  }

  @PutMapping("/{id}/variants")
  public AdminService.AdminProduct setVariants(@PathVariable String id, @Valid @RequestBody AdminDtos.VariantsInput dto) {
    return admin.setVariants(id, dto.label(), dto.variants());
  }

  @PutMapping("/{id}/stock")
  public AdminService.AdminProduct setStock(@PathVariable String id, @Valid @RequestBody AdminDtos.StockInput dto) {
    return admin.setStock(id, dto.stock());
  }

  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(@PathVariable String id) {
    admin.remove(id);
  }

  @PostMapping("/{id}/images") @RateLimit(limit = 30) @ResponseStatus(HttpStatus.CREATED)
  public AdminService.AdminProduct addImage(@PathVariable String id,
      @RequestPart(value = "file", required = false) MultipartFile file,
      @RequestParam(value = "alt", required = false) String alt) throws IOException {
    if (alt != null && alt.trim().length() > 200) throw ApiException.badRequest("alt must be shorter than or equal to 200 characters");
    return admin.addImage(id, file == null ? null : file.getBytes(), alt);
  }

  @PutMapping("/{id}/images/order")
  public AdminService.AdminProduct reorder(@PathVariable String id, @Valid @RequestBody AdminDtos.Reorder dto) {
    return admin.reorderImages(id, dto.ids());
  }

  @DeleteMapping("/{id}/images/{imageId}")
  public AdminService.AdminProduct removeImage(@PathVariable String id, @PathVariable int imageId) {
    return admin.removeImage(id, imageId);
  }
}
