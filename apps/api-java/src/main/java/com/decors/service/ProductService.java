package com.decors.service;

import com.decors.common.ApiException;
import com.decors.domain.Category;
import com.decors.domain.Color;
import com.decors.domain.Product;
import com.decors.domain.ProductImage;
import com.decors.repo.Repositories.ColorRepository;
import com.decors.repo.Repositories.ProductImageRepository;
import com.decors.repo.Repositories.ProductRepository;
import com.decors.repo.Repositories.TagRepository;
import com.decors.service.ProductViews.ImageView;
import com.decors.service.ProductViews.ProductSummary;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductService {
  public static final int DEFAULT_PAGE_SIZE = 24;

  /** {@code correctedQuery} is set when nothing matched as typed and a spelling fix found results. */
  public record ProductPage(long total, List<ProductSummary> items, boolean hasMore, String correctedQuery) {}
  public record NamedColor(String name, String hex) {}
  public record Facets(List<String> categories, List<NamedColor> colors, List<String> tags, int maxPrice) {}
  public record Hall(String category, long count, List<String> colors) {}
  public record Overview(List<Hall> halls, List<ProductSummary> featured, List<String> popularTags, List<NamedColor> colors, List<String> tags) {}
  public record ProductDetail(
      String id, String name, String category, int price, String color, String colorName, List<String> tags,
      double rating, int reviewCount, String description, ImageView image, int stock, boolean personalizable, String variantLabel, List<VariantView> variants, List<ImageView> images, List<ProductSummary> related) {}

  /** Parsed, validated search filters (see {@code ProductQuery}). */
  /** An option as customers see it: its stock is capped like the product's. */
  public record VariantView(String id, String label, int price, int stock) {}

  public record Filters(
      String q, List<String> categories, List<String> colors, List<String> tags,
      Double minPrice, Double maxPrice, Double minRating, Boolean inStock, String sort, Integer limit, Integer offset) {}

  private final ProductRepository products;
  private final ColorRepository colors;
  private final TagRepository tags;
  private final ProductImageRepository images;
  private final ProductViews views;
  private final JdbcClient jdbc;
  private final VariantLookup variants;

  public ProductService(ProductRepository products, ColorRepository colors, TagRepository tags,
      ProductImageRepository images, ProductViews views, JdbcClient jdbc, VariantLookup variants) {
    this.variants = variants;
    this.products = products;
    this.colors = colors;
    this.tags = tags;
    this.images = images;
    this.views = views;
    this.jdbc = jdbc;
  }

  public ProductPage search(Filters f) {
    List<String> tokens = SearchText.tokens(f.q());
    ProductPage page = run(f, tokens, null);
    if (page.total() > 0 || tokens.isEmpty()) return page;
    // Nothing matched as typed: try fixing typos against the words the catalogue actually uses.
    List<String> fixed = SearchText.correct(tokens, vocabulary());
    if (fixed.equals(tokens)) return page;
    ProductPage retry = run(f, fixed, String.join(" ", fixed));
    return retry.total() > 0 ? retry : page;
  }

  private ProductPage run(Filters f, List<String> tokens, String corrected) {
    int limit = f.limit() == null ? DEFAULT_PAGE_SIZE : f.limit();
    int offset = f.offset() == null ? 0 : f.offset();
    boolean relevance = !tokens.isEmpty() && (f.sort() == null || f.sort().isEmpty() || f.sort().equals("relevance"));
    // `id` breaks ties, so pages never repeat or skip a product when many share a price or rating.
    Sort sort = relevance ? Sort.unsorted() : switch (f.sort() == null ? "" : f.sort()) {
      case "price-asc" -> Sort.by(Sort.Order.asc("price"), Sort.Order.asc("id"));
      case "price-desc" -> Sort.by(Sort.Order.desc("price"), Sort.Order.asc("id"));
      case "rating" -> Sort.by(Sort.Order.desc("rating"), Sort.Order.asc("id"));
      case "newest" -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"));
      default -> Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
    };
    var page = products.findAll(spec(f, tokens, relevance), new OffsetPageRequest(offset, limit, sort));
    return new ProductPage(page.getTotalElements(), views.summaries(page.getContent()),
        (long) offset + page.getNumberOfElements() < page.getTotalElements(), corrected);
  }

  /** Every word customers could type: product names, tags, colours and category names. */
  private List<String> vocabulary() {
    List<String> out = new ArrayList<>(jdbc.sql("""
        select name from "Product" union all select name from "Tag" union all select name from "Color"
        """).query(String.class).list());
    for (String slug : Category.slugs()) out.add(slug.replace('-', ' '));
    return SearchText.words(out);
  }

  private static String like(String token) {
    return "%" + token.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
  }

  private static Specification<Product> spec(Filters f, List<String> tokens, boolean relevance) {
    return (root, query, cb) -> {
      boolean fetching = query != null && query.getResultType() != Long.class && query.getResultType() != long.class;
      // Load the colour in the same query, but not in the count query (a fetch join is invalid there).
      if (fetching) root.fetch("color");
      List<Predicate> all = new ArrayList<>();
      // Every word must match somewhere: name, description, a tag, the colour or the category.
      for (String token : tokens) {
        String pattern = like(token);
        Subquery<Integer> tagMatch = query.subquery(Integer.class);
        Root<Product> outer = tagMatch.correlate(root);
        var tag = outer.join("tags");
        tagMatch.select(cb.literal(1)).where(cb.like(cb.lower(tag.get("name")), pattern, '\\'));
        List<Category> cats = Arrays.stream(Category.values()).filter(c -> c.slug().contains(token)).toList();
        List<Predicate> any = new ArrayList<>(List.of(
            cb.like(cb.lower(root.get("name")), pattern, '\\'),
            cb.like(cb.lower(root.get("description")), pattern, '\\'),
            cb.like(cb.lower(root.get("color").get("name")), pattern, '\\'),
            cb.exists(tagMatch)));
        if (!cats.isEmpty()) any.add(root.get("category").in(cats));
        all.add(cb.or(any.toArray(Predicate[]::new)));
      }
      if (relevance && fetching) {
        // Name matches first (word start beats mid-word), then the better-rated piece.
        Expression<Integer> score = cb.literal(0);
        for (String token : tokens) {
          var name = cb.lower(root.<String>get("name"));
          score = cb.sum(score, cb.<Integer>selectCase()
              .when(cb.like(name, token.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%", '\\'), 4)
              .when(cb.like(name, "% " + like(token).substring(1), '\\'), 3)
              .when(cb.like(name, like(token), '\\'), 2)
              .otherwise(0));
        }
        query.orderBy(cb.desc(score), cb.desc(root.get("rating")), cb.asc(root.get("id")));
      }
      if (f.categories() != null && !f.categories().isEmpty()) {
        List<Category> cats = f.categories().stream().map(Category::fromSlug).flatMap(java.util.Optional::stream).toList();
        // Unknown categories match nothing, like the NestJS API.
        all.add(cats.isEmpty() ? cb.disjunction() : root.get("category").in(cats));
      }
      if (f.colors() != null && !f.colors().isEmpty()) {
        all.add(root.get("color").get("name").in(f.colors()));
      }
      if (f.tags() != null && !f.tags().isEmpty()) {
        Subquery<Integer> sq = query.subquery(Integer.class);
        Root<Product> outer = sq.correlate(root);
        var tag = outer.join("tags");
        sq.select(cb.literal(1)).where(tag.get("name").in(f.tags()));
        all.add(cb.exists(sq));
      }
      Expression<Integer> price = root.get("price");
      if (f.minPrice() != null) all.add(cb.ge(price, f.minPrice()));
      if (f.maxPrice() != null) all.add(cb.le(price, f.maxPrice()));
      if (f.minRating() != null && f.minRating() > 0) all.add(cb.ge(root.<Double>get("rating"), f.minRating()));
      if (Boolean.TRUE.equals(f.inStock())) all.add(cb.greaterThan(root.<Integer>get("stock"), 0));
      return cb.and(all.toArray(Predicate[]::new));
    };
  }

  public Facets facets() {
    // Only colours and tags that at least one product uses (deleted products can leave them behind).
    List<NamedColor> c = colors.findInUse().stream().map(x -> new NamedColor(x.name, x.hex)).toList();
    List<String> t = tags.findInUse().stream().map(x -> x.name).toList();
    Integer max = products.maxPrice();
    return new Facets(Category.slugs(), c, t, max == null ? 0 : max);
  }

  /**
   * Everything the landing page needs in one request, computed in the database
   * (counts and colours per category, top-rated pieces, popular tags).
   */
  public Overview overview() {
    Facets facets = facets();
    Map<Integer, String> hexById = colors.findAll().stream().collect(Collectors.toMap(x -> x.id, x -> x.hex));
    Map<Category, Map<Integer, Long>> counts = new LinkedHashMap<>();
    for (Object[] row : products.countsByCategoryAndColor()) {
      counts.computeIfAbsent((Category) row[0], k -> new LinkedHashMap<>()).put((Integer) row[1], (Long) row[2]);
    }
    List<Hall> halls = Arrays.stream(Category.values()).map(cat -> {
      Map<Integer, Long> perColor = counts.getOrDefault(cat, Map.of());
      List<String> hexes = perColor.entrySet().stream()
          .sorted(Map.Entry.<Integer, Long>comparingByValue().reversed())
          .limit(6).map(e -> hexById.get(e.getKey())).filter(java.util.Objects::nonNull).toList();
      return new Hall(cat.slug(), perColor.values().stream().mapToLong(Long::longValue).sum(), hexes);
    }).toList();
    var featured = products.findAll(PageRequest.of(0, 6, Sort.by(Sort.Order.desc("rating"), Sort.Order.asc("id")))).getContent();
    List<String> popular = jdbc.sql("""
            select t.name from "Tag" t join "_ProductToTag" j on j."B" = t.id
            group by t.id, t.name order by count(*) desc, t.name asc limit 5
            """).query(String.class).list();
    return new Overview(halls, views.summaries(featured), popular, facets.colors(), facets.tags());
  }

  private List<VariantView> variantViews(String productId) {
    return variants.activeFor(List.of(productId)).getOrDefault(productId, List.of()).stream()
        .map(v -> new VariantView(v.id(), v.label(), v.price(), Math.min(v.stock(), ProductViews.STOCK_CAP))).toList();
  }

  public ProductDetail findOne(String id) {
    Product p = products.findWithColor(id).orElseThrow(() -> ApiException.notFound("Product not found"));
    ProductSummary s = views.summary(p);
    List<ImageView> all = images.findByProductIdOrderByPositionAscIdAsc(id).stream()
        .map((ProductImage i) -> new ImageView(views.publicUrl(i.url), i.alt)).toList();
    List<Product> related = products.related(id, p.category, p.color.id, PageRequest.of(0, 4));
    return new ProductDetail(s.id(), s.name(), s.category(), s.price(), s.color(), s.colorName(), s.tags(),
        s.rating(), s.reviewCount(), s.description(), s.image(), s.stock(), s.personalizable(), p.variantLabel, variantViews(id), all, views.summaries(related));
  }

  /** Used by admin and account code. */
  public Color requireColor(Integer id) {
    return colors.findById(id).orElseThrow(() -> ApiException.notFound("Colour not found"));
  }
}
