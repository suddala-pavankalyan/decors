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
  public record CartLineView(int qty, ProductSummary product) {}
  public record State(List<CartLineView> cart, List<ProductSummary> wishlist) {}

  private final CartItemRepository cart;
  private final WishlistItemRepository wishlist;
  private final ProductRepository products;
  private final ProductViews views;
  private final JdbcClient jdbc;
  private final jakarta.persistence.EntityManager em;

  public AccountService(CartItemRepository cart, WishlistItemRepository wishlist, ProductRepository products,
      ProductViews views, JdbcClient jdbc, jakarta.persistence.EntityManager em) {
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
    return new State(
        lines.stream().map(l -> new CartLineView(l.qty, byId.get(l.product.id))).toList(),
        wished.stream().map(w -> byId.get(w.product.id)).toList());
  }

  @Transactional
  public void setQty(String userId, String productId, int qty) {
    if (qty == 0) {
      jdbc.sql("delete from \"CartItem\" where \"userId\" = :u and \"productId\" = :p").param("u", userId).param("p", productId).update();
      return;
    }
    Product p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Product not found"));
    if (qty > p.stock) throw ApiException.conflict(StockMessages.shortage(p.name, p.stock));
    upsertCart(userId, productId, qty);
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
    for (var l : dto.cart()) {
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
      if (allowed > 0) upsertCart(userId, pid, allowed);
    });
    dto.wishlist().stream().filter(known::contains).distinct().forEach(pid -> insertWish(userId, pid));
    // The upserts above went around JPA, so drop what it cached before reading the result back.
    em.clear();
    return state(userId);
  }

  private void requireProduct(String productId) {
    if (!products.existsById(productId)) throw ApiException.notFound("Product not found");
  }

  private void upsertCart(String userId, String productId, int qty) {
    jdbc.sql("""
            insert into "CartItem" ("userId", "productId", qty, "updatedAt") values (:u, :p, :q, :t)
            on conflict ("userId", "productId") do update set qty = excluded.qty, "updatedAt" = excluded."updatedAt"
            """)
        .param("u", userId).param("p", productId).param("q", qty).param("t", Time.now()).update();
  }

  private void insertWish(String userId, String productId) {
    jdbc.sql("insert into \"WishlistItem\" (\"userId\", \"productId\") values (:u, :p) on conflict do nothing")
        .param("u", userId).param("p", productId).update();
  }
}
