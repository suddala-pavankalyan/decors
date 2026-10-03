package com.decors.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Reads product options (variants) for carts, checkout and product pages. */
@Component
public class VariantLookup {
  public record Row(String id, String productId, String label, int price, int stock, boolean active) {}

  private final JdbcClient jdbc;

  public VariantLookup(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  private static final String COLS = "id, \"productId\", label, price, stock, active";

  private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new Row(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getInt(5), rs.getBoolean(6));
  }

  /** The given options by id (inactive ones included, so a cart line can tell its option was withdrawn). */
  public Map<String, Row> byIds(Collection<String> ids) {
    Map<String, Row> out = new HashMap<>();
    if (ids.isEmpty()) return out;
    jdbc.sql("select " + COLS + " from \"ProductVariant\" where id in (:ids)").param("ids", ids).query((rs, n) -> row(rs)).list()
        .forEach(r -> out.put(r.id(), r));
    return out;
  }

  /**
   * The option a cart line or order asks for: required (and must belong to the product and be on sale) when the product
   * has options, and not allowed when it has none. Returns null for products without options.
   */
  public Row resolve(com.decors.domain.Product p, String variantId) {
    String vid = variantId == null ? "" : variantId;
    if (p.variantLabel == null) {
      if (!vid.isEmpty()) throw com.decors.common.ApiException.badRequest(p.name + " has no options to choose from");
      return null;
    }
    if (vid.isEmpty()) throw com.decors.common.ApiException.badRequest("Choose a " + p.variantLabel.toLowerCase() + " for " + p.name);
    Row r = byIds(List.of(vid)).get(vid);
    if (r == null || !r.productId().equals(p.id) || !r.active()) {
      throw com.decors.common.ApiException.badRequest("That " + p.variantLabel.toLowerCase() + " of " + p.name + " is no longer available");
    }
    return r;
  }

  /** Active options of the given products, in the order the admin set, grouped by product. */
  public Map<String, List<Row>> activeFor(Collection<String> productIds) {
    Map<String, List<Row>> out = new HashMap<>();
    if (productIds.isEmpty()) return out;
    jdbc.sql("select " + COLS + " from \"ProductVariant\" where \"productId\" in (:ids) and active order by \"productId\", position, id")
        .param("ids", productIds).query((rs, n) -> row(rs)).list()
        .forEach(r -> out.computeIfAbsent(r.productId(), k -> new java.util.ArrayList<>()).add(r));
    return out;
  }
}
