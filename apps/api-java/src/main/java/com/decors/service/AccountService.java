package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Time;
import com.decors.domain.CartItem;
import com.decors.domain.Product;
import com.decors.domain.WishlistItem;
import com.decors.repo.Repositories.CartItemRepository;
import com.decors.repo.Repositories.ProductRepository;
import com.decors.repo.Repositories.WishlistItemRepository;
import com.decors.service.ProductViews.ProductSummary;
import com.decors.web.dto.AccountDtos;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {
  public record CartLineView(int qty, com.fasterxml.jackson.databind.JsonNode personalization, ProductService.VariantView variant, ProductSummary product) {}
  public record State(List<CartLineView> cart, List<ProductSummary> wishlist) {}

  private final CartItemRepository cart;
  private final WishlistItemRepository wishlist;
  private final ProductRepository products;
  private final ProductViews views;
  private final JdbcClient jdbc;
  private final jakarta.persistence.EntityManager em;
  private final PersonalizationService personalization;
  private final VariantLookup variants;

  public AccountService(CartItemRepository cart, WishlistItemRepository wishlist, ProductRepository products,
      ProductViews views, JdbcClient jdbc, jakarta.persistence.EntityManager em, PersonalizationService personalization, VariantLookup variants) {
    this.variants = variants;
    this.personalization = personalization;
    this.em = em;
    this.cart = cart;
    this.wishlist = wishlist;
    this.products = products;
    this.views = views;
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public State state(String userId) {
    List<CartItem> lines = cart.findForUser(userId);
    List<WishlistItem> wished = wishlist.findForUser(userId);
    // One batch for all products so tags and photos load in two queries, not two per product.
    List<Product> all = new ArrayList<>();
    lines.forEach(l -> all.add(l.product));
    wished.forEach(w -> all.add(w.product));
    Map<String, ProductSummary> byId = new HashMap<>();
    for (ProductSummary s : views.summaries(all.stream().distinct().toList())) byId.put(s.id(), s);
    // The details typed for personalised cards are kept as JSON next to the quantity.
    Map<String, String> saved = new HashMap<>();
    jdbc.sql("select \"productId\", \"variantId\", personalization::text as p from \"CartItem\" where \"userId\" = :u and personalization is not null")
        .param("u", userId).query((rs, n) -> Map.entry(key(rs.getString(1), rs.getString(2)), rs.getString(3))).list().forEach(e -> saved.put(e.getKey(), e.getValue()));
    Map<String, VariantLookup.Row> options = variants.byIds(lines.stream().map(l -> l.id.variantId()).filter(v -> !v.isEmpty()).toList());
    return new State(
        lines.stream().map(l -> {
          VariantLookup.Row v = options.get(l.id.variantId());
          return new CartLineView(l.qty, personalization.read(saved.get(key(l.product.id, l.id.variantId()))),
              v == null ? null : new ProductService.VariantView(v.id(), v.label(), v.price(), Math.min(v.stock(), ProductViews.STOCK_CAP)),
              byId.get(l.product.id));
        }).toList(),
        wished.stream().map(w -> byId.get(w.product.id)).toList());
  }

  @Transactional
  public void setQty(String userId, String productId, String variantId, int qty, AccountDtos.Personalization details) {
    String vid = variantId == null ? "" : variantId;
    if (qty == 0) {
      jdbc.sql("delete from \"CartItem\" where \"userId\" = :u and \"productId\" = :p and \"variantId\" = :v").param("u", userId).param("p", productId).param("v", vid).update();
      return;
    }
    Product p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Product not found"));
    VariantLookup.Row option = variants.resolve(p, vid);
    int available = option != null ? option.stock() : p.stock;
    if (qty > available) throw ApiException.conflict(StockMessages.shortage(option != null ? p.name + " (" + option.label() + ")" : p.name, available));
    String stored = null;
    if (details != null) {
      if (!p.personalizable) throw ApiException.badRequest(p.name + " cannot be personalised");
      stored = personalization.validate(details);
    }
    upsertCart(userId, productId, vid, qty, stored);
  }

  @Transactional
  public void clearCart(String userId) {
    jdbc.sql("delete from \"CartItem\" where \"userId\" = :u").param("u", userId).update();
  }

  @Transactional
  public void addWish(String userId, String productId) {
    requireProduct(productId);
    insertWish(userId, productId);
  }

  @Transactional
  public void removeWish(String userId, String productId) {
    jdbc.sql("delete from \"WishlistItem\" where \"userId\" = :u and \"productId\" = :p").param("u", userId).param("p", productId).update();
  }

  /** Fold a guest's local cart/wishlist into the account: quantities add (capped), wishlist unions. */
  @Transactional
  public State merge(String userId, AccountDtos.Merge dto) {
    Set<String> ids = new LinkedHashSet<>();
    dto.cart().forEach(l -> ids.add(l.productId()));
    ids.addAll(dto.wishlist());
    Set<String> known = ids.isEmpty() ? Set.of()
        : products.findAllById(ids).stream().map(p -> p.id).collect(Collectors.toSet());

    Map<String, Integer> guest = new LinkedHashMap<>();
    Map<String, String> guestDetails = new HashMap<>();
    Map<String, Product> byProduct = new HashMap<>();
    if (!ids.isEmpty()) products.findAllById(ids).forEach(p -> byProduct.put(p.id, p));
    Map<String, VariantLookup.Row> options = variants.byIds(dto.cart().stream().map(l -> l.variantId() == null ? "" : l.variantId()).filter(v -> !v.isEmpty()).toList());
    Map<String, Integer> stock = new HashMap<>();
    for (var l : dto.cart()) {
      Product p = byProduct.get(l.productId());
      if (p == null) continue;
      String vid = l.variantId() == null ? "" : l.variantId();
      VariantLookup.Row v = options.get(vid);
      // A line whose option does not exist (any more) is left out rather than failing the whole merge.
      boolean valid = p.variantLabel == null ? vid.isEmpty() : v != null && v.productId().equals(p.id) && v.active();
      if (!valid) continue;
      String k = key(p.id, vid);
      stock.put(k, v != null ? v.stock() : p.stock);
      if (l.personalization() != null && p.personalizable) {
        try {
          guestDetails.put(k, personalization.validate(l.personalization()));
        } catch (ApiException e) {
          // Details that no longer make sense (such as a date now in the past) are dropped; the customer is asked again at checkout.
        }
      }
      guest.merge(k, l.qty(), (a, b) -> Math.min(AccountDtos.MAX_QTY, a + b));
    }
    Map<String, Integer> have = new HashMap<>();
    if (!guest.isEmpty()) {
      cart.findForUserAndProducts(userId, guest.keySet().stream().map(k -> k.substring(0, k.indexOf('|'))).collect(Collectors.toSet()))
          .forEach(c -> have.put(key(c.id.productId(), c.id.variantId()), c.qty));
    }
    // Never put more in the cart than is in stock; a sold-out item is simply left out.
    guest.forEach((k, qty) -> {
      int want = Math.min(AccountDtos.MAX_QTY, have.getOrDefault(k, 0) + qty);
      int allowed = Math.min(want, stock.getOrDefault(k, 0));
      if (allowed > 0) upsertCart(userId, k.substring(0, k.indexOf('|')), k.substring(k.indexOf('|') + 1), allowed, guestDetails.get(k));
    });
    dto.wishlist().stream().filter(known::contains).distinct().forEach(pid -> insertWish(userId, pid));
    // The upserts above went around JPA, so drop what it cached before reading the result back.
    em.clear();
    return state(userId);
  }

  private void requireProduct(String productId) {
    if (!products.existsById(productId)) throw ApiException.notFound("Product not found");
  }

  /** {@code details} (JSON) replaces the saved personalisation; null leaves what is already there. */
  static String key(String productId, String variantId) {
    return productId + "|" + (variantId == null ? "" : variantId);
  }

  private void upsertCart(String userId, String productId, String variantId, int qty, String details) {
    jdbc.sql("""
            insert into "CartItem" ("userId", "productId", "variantId", qty, "updatedAt", personalization) values (:u, :p, :v, :q, :t, cast(:d as jsonb))
            on conflict ("userId", "productId", "variantId") do update set qty = excluded.qty, "updatedAt" = excluded."updatedAt",
                   personalization = coalesce(excluded.personalization, "CartItem".personalization)
            """)
        .param("u", userId).param("p", productId).param("v", variantId).param("q", qty).param("t", Time.now()).param("d", details).update();
  }

  private void insertWish(String userId, String productId) {
    jdbc.sql("insert into \"WishlistItem\" (\"userId\", \"productId\") values (:u, :p) on conflict do nothing")
        .param("u", userId).param("p", productId).update();
  }
}
