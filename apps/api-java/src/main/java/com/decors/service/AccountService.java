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
  public record CartLineView(int qty, com.fasterxml.jackson.databind.JsonNode personalization, ProductSummary product) {}
  public record State(List<CartLineView> cart, List<ProductSummary> wishlist) {}

  private final CartItemRepository cart;
  private final WishlistItemRepository wishlist;
  private final ProductRepository products;
  private final ProductViews views;
  private final JdbcClient jdbc;
  private final jakarta.persistence.EntityManager em;
  private final PersonalizationService personalization;

  public AccountService(CartItemRepository cart, WishlistItemRepository wishlist, ProductRepository products,
      ProductViews views, JdbcClient jdbc, jakarta.persistence.EntityManager em, PersonalizationService personalization) {
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
    jdbc.sql("select \"productId\", personalization::text as p from \"CartItem\" where \"userId\" = :u and personalization is not null")
        .param("u", userId).query((rs, n) -> Map.entry(rs.getString(1), rs.getString(2))).list().forEach(e -> saved.put(e.getKey(), e.getValue()));
    return new State(
        lines.stream().map(l -> new CartLineView(l.qty, personalization.read(saved.get(l.product.id)), byId.get(l.product.id))).toList(),
        wished.stream().map(w -> byId.get(w.product.id)).toList());
  }

  @Transactional
  public void setQty(String userId, String productId, int qty, AccountDtos.Personalization details) {
    if (qty == 0) {
      jdbc.sql("delete from \"CartItem\" where \"userId\" = :u and \"productId\" = :p").param("u", userId).param("p", productId).update();
      return;
    }
    Product p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Product not found"));
    if (qty > p.stock) throw ApiException.conflict(StockMessages.shortage(p.name, p.stock));
    String stored = null;
    if (details != null) {
      if (!p.personalizable) throw ApiException.badRequest(p.name + " cannot be personalised");
      stored = personalization.validate(details);
    }
    upsertCart(userId, productId, qty, stored);
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
    for (var l : dto.cart()) {
      if (l.personalization() != null && known.contains(l.productId()) && byProduct.get(l.productId()).personalizable) {
        try {
          guestDetails.put(l.productId(), personalization.validate(l.personalization()));
        } catch (ApiException e) {
          // Details that no longer make sense (such as a date now in the past) are dropped; the customer is asked again at checkout.
        }
      }
      if (known.contains(l.productId())) guest.merge(l.productId(), l.qty(), (a, b) -> Math.min(AccountDtos.MAX_QTY, a + b));
    }
    Map<String, Integer> have = new HashMap<>();
    if (!guest.isEmpty()) {
      cart.findForUserAndProducts(userId, guest.keySet()).forEach(c -> have.put(c.id.productId(), c.qty));
    }
    // Never put more in the cart than is in stock; a sold-out item is simply left out.
    Map<String, Integer> stock = new HashMap<>();
    products.findAllById(guest.keySet()).forEach(p -> stock.put(p.id, p.stock));
    guest.forEach((pid, qty) -> {
      int want = Math.min(AccountDtos.MAX_QTY, have.getOrDefault(pid, 0) + qty);
      int allowed = Math.min(want, stock.getOrDefault(pid, 0));
      if (allowed > 0) upsertCart(userId, pid, allowed, guestDetails.get(pid));
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
  private void upsertCart(String userId, String productId, int qty, String details) {
    jdbc.sql("""
            insert into "CartItem" ("userId", "productId", qty, "updatedAt", personalization) values (:u, :p, :q, :t, cast(:d as jsonb))
            on conflict ("userId", "productId") do update set qty = excluded.qty, "updatedAt" = excluded."updatedAt",
                   personalization = coalesce(excluded.personalization, "CartItem".personalization)
            """)
        .param("u", userId).param("p", productId).param("q", qty).param("t", Time.now()).param("d", details).update();
  }

  private void insertWish(String userId, String productId) {
    jdbc.sql("insert into \"WishlistItem\" (\"userId\", \"productId\") values (:u, :p) on conflict do nothing")
        .param("u", userId).param("p", productId).update();
  }
}
