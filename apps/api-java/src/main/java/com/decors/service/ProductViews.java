package com.decors.service;

import com.decors.config.AppProperties;
import com.decors.domain.Product;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Turns products into the JSON the website expects, loading tags and the first photo for a whole list in
 * two queries (instead of two per product).
 */
@Component
public class ProductViews {
  public record ImageView(String url, String alt) {}

  public record ProductSummary(
      String id, String name, String category, int price, String color, String colorName,
      List<String> tags, double rating, String description, ImageView image) {}

  private final JdbcClient jdbc;
  private final AppProperties props;

  public ProductViews(JdbcClient jdbc, AppProperties props) {
    this.jdbc = jdbc;
    this.props = props;
  }

  /** Our own uploads are stored as "/uploads/x.jpg"; clients need an absolute URL to this API. External URLs pass through. */
  public String publicUrl(String url) {
    return url.startsWith("/") ? props.apiPublicUrl().replaceAll("/+$", "") + url : url;
  }

  public List<ProductSummary> summaries(List<Product> products) {
    if (products.isEmpty()) return List.of();
    List<String> ids = products.stream().map(p -> p.id).toList();
    Map<String, List<String>> tags = tagNames(ids);
    Map<String, ImageView> firstImage = firstImages(ids);
    List<ProductSummary> out = new ArrayList<>(products.size());
    for (Product p : products) {
      out.add(new ProductSummary(
          p.id, p.name, p.category.slug(), p.price, p.color.hex, p.color.name,
          tags.getOrDefault(p.id, List.of()), p.rating, p.description, firstImage.get(p.id)));
    }
    return out;
  }

  public ProductSummary summary(Product p) {
    return summaries(List.of(p)).get(0);
  }

  private Map<String, List<String>> tagNames(Collection<String> ids) {
    Map<String, List<String>> out = new HashMap<>();
    jdbc.sql("""
            select j."A" as pid, t.name as name
            from "_ProductToTag" j join "Tag" t on t.id = j."B"
            where j."A" in (:ids) order by t.name
            """)
        .param("ids", ids)
        .query((rs, i) -> Map.entry(rs.getString("pid"), rs.getString("name")))
        .list()
        .forEach(e -> out.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
    return out;
  }

  private Map<String, ImageView> firstImages(Collection<String> ids) {
    Map<String, ImageView> out = new HashMap<>();
    jdbc.sql("""
            select distinct on ("productId") "productId" as pid, url, alt
            from "ProductImage" where "productId" in (:ids)
            order by "productId", position, id
            """)
        .param("ids", ids)
        .query((rs, i) -> Map.entry(rs.getString("pid"), new ImageView(publicUrl(rs.getString("url")), rs.getString("alt"))))
        .list()
        .forEach(e -> out.put(e.getKey(), e.getValue()));
    return out;
  }
}
