package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.Category;
import com.decors.domain.Color;
import com.decors.domain.Product;
import com.decors.domain.ProductImage;
import com.decors.domain.Tag;
import com.decors.repo.Repositories.ColorRepository;
import com.decors.repo.Repositories.ProductImageRepository;
import com.decors.repo.Repositories.ProductRepository;
import com.decors.repo.Repositories.TagRepository;
import com.decors.storage.ImageStorage;
import com.decors.web.dto.AdminDtos;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AdminService {
  public static final int MAX_IMAGES = 8;
  /** At or below this many units a product counts as low on stock. */
  public static final int LOW_STOCK = 5;

  public record AdminImage(int id, String url, String alt) {}
  public record AdminProduct(
      String id, String name, String category, int price, int stock, double rating, String description,
      String colorName, String colorHex, List<String> tags, List<AdminImage> images) {}
  public record AdminPage(long total, List<AdminProduct> items, boolean hasMore) {}

  private final ProductRepository products;
  private final ColorRepository colors;
  private final TagRepository tags;
  private final ProductImageRepository images;
  private final ProductViews views;
  private final ImageStorage storage;
  private final JdbcClient jdbc;

  public AdminService(ProductRepository products, ColorRepository colors, TagRepository tags, ProductImageRepository images,
      ProductViews views, ImageStorage storage, JdbcClient jdbc) {
    this.products = products;
    this.colors = colors;
    this.tags = tags;
    this.images = images;
    this.views = views;
    this.storage = storage;
    this.jdbc = jdbc;
  }

  /** One page of products, newest first, optionally filtered by name or category (done in the database). */
  @Transactional(readOnly = true)
  public AdminPage list(String q, String stock, Integer limit, Integer offset) {
    String text = q == null ? "" : q.trim();
    int take = limit == null ? 30 : limit;
    int skip = offset == null ? 0 : offset;
    Specification<Product> spec = (root, query, cb) -> {
      var stockFilter = switch (stock == null ? "" : stock) {
        case "low" -> cb.lessThanOrEqualTo(root.<Integer>get("stock"), LOW_STOCK);
        case "out" -> cb.equal(root.<Integer>get("stock"), 0);
        default -> cb.conjunction();
      };
      if (text.isEmpty()) return stockFilter;
      String pattern = "%" + text.toLowerCase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      List<Category> cats = Category.slugs().stream()
          .filter(s -> s.replace('-', ' ').contains(text.toLowerCase()))
          .map(s -> Category.fromSlug(s).orElseThrow()).toList();
      var byName = cb.like(cb.lower(root.get("name")), pattern, '\\');
      return cb.and(stockFilter, cats.isEmpty() ? byName : cb.or(byName, root.get("category").in(cats)));
    };
    var page = products.findAll(spec, new OffsetPageRequest(skip, take,
        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"))));
    return new AdminPage(page.getTotalElements(), toDtos(page.getContent()),
        (long) skip + page.getNumberOfElements() < page.getTotalElements());
  }

  @Transactional(readOnly = true)
  public AdminProduct get(String id) {
    return toDtos(List.of(products.findById(id).orElseThrow(() -> ApiException.notFound("Product not found")))).get(0);
  }

  public AdminProduct create(AdminDtos.ProductInput in) {
    Category category = category(in.category());
    Color color = resolveColor(in.colorName(), in.colorHex());
    Product p = new Product();
    p.id = Ids.newId();
    p.createdAt = Time.now();
    apply(p, in, category, color);
    products.saveAndFlush(p);
    return get(p.id);
  }

  public AdminProduct update(String id, AdminDtos.ProductInput in) {
    Product p = products.findById(id).orElseThrow(() -> ApiException.notFound("Product not found"));
    Category category = category(in.category());
    Color color = resolveColor(in.colorName(), in.colorHex());
    apply(p, in, category, color);
    products.saveAndFlush(p);
    return get(id);
  }

  /** Cart/wishlist rows go with the product (database cascade); past orders keep their name/price snapshot. */
  public void remove(String id) {
    if (!products.existsById(id)) throw ApiException.notFound("Product not found");
    List<ProductImage> own = images.findByProductIdOrderByPositionAscIdAsc(id);
    jdbc.sql("delete from \"Product\" where id = :id").param("id", id).update();
    own.forEach(i -> storage.remove(i.url));
  }

  public AdminProduct setStock(String id, int stock) {
    Product p = products.findById(id).orElseThrow(() -> ApiException.notFound("Product not found"));
    p.stock = stock;
    products.saveAndFlush(p);
    return get(id);
  }

  public AdminProduct addImage(String productId, byte[] file, String alt) {
    if (file == null) throw ApiException.badRequest("Attach an image in the \"file\" field");
    Product product = products.findById(productId).orElseThrow(() -> ApiException.notFound("Product not found"));
    List<ProductImage> existing = images.findByProductIdOrderByPositionAscIdAsc(productId);
    if (existing.size() >= MAX_IMAGES) {
      throw ApiException.badRequest("A product can have at most " + MAX_IMAGES + " images");
    }
    String url = storage.save(file);
    try {
      int position = existing.stream().mapToInt(i -> i.position).max().orElse(-1) + 1;
      ProductImage img = new ProductImage();
      img.productId = productId;
      img.url = url;
      img.position = position;
      String trimmed = alt == null ? "" : alt.trim();
      img.alt = trimmed.isEmpty() ? product.name + " – photo " + (position + 1) : trimmed;
      images.saveAndFlush(img);
    } catch (RuntimeException e) {
      storage.remove(url); // don't leave an orphan file if the row couldn't be saved
      throw e;
    }
    return get(productId);
  }

  public AdminProduct removeImage(String productId, int imageId) {
    ProductImage img = images.findByIdAndProductId(imageId, productId).orElseThrow(() -> ApiException.notFound("Image not found"));
    images.delete(img);
    images.flush();
    storage.remove(img.url);
    return get(productId);
  }

  /** {@code ids} must be exactly this product's image ids, in the desired order (first = main photo). */
  public AdminProduct reorderImages(String productId, List<Integer> ids) {
    if (!products.existsById(productId)) throw ApiException.notFound("Product not found");
    List<ProductImage> current = images.findByProductIdOrderByPositionAscIdAsc(productId);
    Set<Integer> wanted = new LinkedHashSet<>(ids);
    boolean same = ids.size() == current.size() && wanted.size() == ids.size()
        && current.stream().allMatch(c -> wanted.contains(c.id));
    if (!same) throw ApiException.badRequest("ids must list each of the product's images exactly once");
    Map<Integer, ProductImage> byId = current.stream().collect(Collectors.toMap(i -> i.id, i -> i));
    for (int pos = 0; pos < ids.size(); pos++) byId.get(ids.get(pos)).position = pos;
    images.flush();
    return get(productId);
  }

  // ───────── helpers ─────────

  private static Category category(String slug) {
    return Category.fromSlug(slug).orElseThrow(() -> ApiException.badRequest(
        "category must be one of the following values: " + String.join(", ", Category.slugs())));
  }

  private void apply(Product p, AdminDtos.ProductInput in, Category category, Color color) {
    p.name = in.name();
    p.category = category;
    p.price = in.price();
    p.stock = in.stock();
    p.rating = in.rating();
    p.description = in.description();
    p.color = color;
    Map<String, Tag> existing = in.tags().isEmpty() ? Map.of()
        : tags.findByNameIn(in.tags()).stream().collect(Collectors.toMap(t -> t.name, t -> t));
    Set<Tag> next = new LinkedHashSet<>();
    for (String name : in.tags()) {
      Tag t = existing.get(name);
      if (t == null) {
        t = new Tag();
        t.name = name;
        t = tags.saveAndFlush(t);
      }
      next.add(t);
    }
    p.tags.clear();
    p.tags.addAll(next);
  }

  /** Colours are shared by name. Reuse an existing one, but never silently change its hex for other products. */
  private Color resolveColor(String name, String hex) {
    Color existing = colors.findFirstByNameIgnoreCase(name).orElse(null);
    if (existing != null) {
      if (!existing.hex.equalsIgnoreCase(hex)) {
        // Nobody uses it any more, so it's safe to give the name a new shade.
        if (products.countByColor(existing.id) == 0) {
          existing.hex = hex.toUpperCase();
          return colors.save(existing);
        }
        throw ApiException.conflict("Colour \"" + existing.name + "\" already exists as " + existing.hex
            + ". Pick it from the list or use a different name.");
      }
      return existing;
    }
    Color c = new Color();
    c.name = name;
    c.hex = hex.toUpperCase();
    return colors.saveAndFlush(c);
  }

  private List<AdminProduct> toDtos(Collection<Product> rows) {
    if (rows.isEmpty()) return List.of();
    Map<String, List<AdminImage>> imgs = new HashMap<>();
    for (ProductImage i : images.findByProductIdInOrderByPositionAscIdAsc(rows.stream().map(r -> r.id).toList())) {
      imgs.computeIfAbsent(i.productId, k -> new ArrayList<>()).add(new AdminImage(i.id, views.publicUrl(i.url), i.alt));
    }
    List<AdminProduct> out = new ArrayList<>();
    for (Product r : rows) {
      // The entities expose public fields, which a lazy proxy does not fill in, so use the real instance.
      Color color = (Color) org.hibernate.Hibernate.unproxy(r.color);
      out.add(new AdminProduct(r.id, r.name, r.category.slug(), r.price, r.stock, r.rating, r.description,
          color.name, color.hex, r.tags.stream().map(t -> t.name).sorted().toList(),
          imgs.getOrDefault(r.id, List.of())));
    }
    return out;
  }
}
