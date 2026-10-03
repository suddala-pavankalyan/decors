package com.decors.web;

import com.decors.service.ProductService.Filters;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.util.Arrays;
import java.util.List;

/** Query-string parameters of {@code GET /products}; bound by Spring from the URL. */
public class ProductQuery {
  public String q;
  public String categories;
  public String colors;
  public String tags;
  @Min(value = 0, message = "minPrice must not be less than 0") public Double minPrice;
  @Min(value = 0, message = "maxPrice must not be less than 0") public Double maxPrice;
  @Pattern(regexp = "price-asc|price-desc|rating", message = "sort must be one of the following values: price-asc, price-desc, rating")
  public String sort;
  /** Page size (default 24, at most 60) and how many results to skip. */
  @Min(value = 1, message = "limit must not be less than 1") @Max(value = 60, message = "limit must not be greater than 60")
  public Integer limit;
  @Min(value = 0, message = "offset must not be less than 0") @Max(value = 100000, message = "offset must not be greater than 100000")
  public Integer offset;

  // Spring binds query parameters through setters.
  public void setQ(String v) { q = v; }
  public void setCategories(String v) { categories = v; }
  public void setColors(String v) { colors = v; }
  public void setTags(String v) { tags = v; }
  public void setMinPrice(Double v) { minPrice = v; }
  public void setMaxPrice(Double v) { maxPrice = v; }
  public void setSort(String v) { sort = v; }
  public void setLimit(Integer v) { limit = v; }
  public void setOffset(Integer v) { offset = v; }

  private static List<String> csv(String v) {
    return v == null ? null : Arrays.stream(v.split(",")).filter(s -> !s.isEmpty()).toList();
  }

  public Filters toFilters() {
    return new Filters(q, csv(categories), csv(colors), csv(tags), minPrice, maxPrice, sort, limit, offset);
  }
}
