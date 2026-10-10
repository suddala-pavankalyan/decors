package com.decors.web;

import com.decors.service.ProductService;
import com.decors.service.ProductService.Facets;
import com.decors.service.ProductService.Overview;
import com.decors.service.ProductService.ProductDetail;
import com.decors.service.ProductService.ProductPage;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/products")
public class ProductController {
  private final ProductService products;

  public ProductController(ProductService products) {
    this.products = products;
  }

  @GetMapping
  public ProductPage list(@Valid ProductQuery query) {
    return products.search(query.toFilters());
  }

  @GetMapping("/facets")
  public Facets facets(@RequestParam(required = false) String category) {
    return products.facets(category);
  }

  @GetMapping("/overview")
  public Overview overview(@RequestParam(required = false) String category) {
    return products.overview(category);
  }

  @GetMapping("/{id}")
  public ProductDetail one(@PathVariable String id) {
    return products.findOne(id);
  }
}
