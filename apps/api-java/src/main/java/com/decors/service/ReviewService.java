package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.AppUser;
import com.decors.storage.ImageStorage;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Customer reviews. Only people who have received the product can review it, once per product; they can edit or delete
 * their review and add up to three photos. Admins can hide a review (it then stops counting towards the rating) or reply.
 * The product's rating and review count are kept by a database trigger.
 */
@Service
public class ReviewService {
  public static final int MAX_PHOTOS = 3;
  static final String CANNOT = "Only customers who have received this product can review it";

  public record Photo(int id, String url) {}

  public record ReviewView(String id, int rating, String title, String body, String authorName, boolean verifiedBuyer, LocalDateTime createdAt,
      List<Photo> photos, String reply, LocalDateTime repliedAt) {}

  public record Summary(double average, long count, Map<String, Long> histogram) {}

  public record ReviewPage(Summary summary, long total, List<ReviewView> items, boolean hasMore) {}

  public record Mine(ReviewView review, String status, boolean canReview, String reason) {}

  public record AdminRow(String id, String productId, String productName, String userName, String userEmail, int rating, String title, String body,
      String status, String reply, LocalDateTime repliedAt, LocalDateTime createdAt, List<Photo> photos) {}

  public record AdminPage(long total, List<AdminRow> items, boolean hasMore, Map<String, Long> counts) {}

  private final JdbcClient jdbc;
  private final ImageStorage storage;
  private final ProductViews views;

  public ReviewService(JdbcClient jdbc, ImageStorage storage, ProductViews views) {
    this.jdbc = jdbc;
    this.storage = storage;
    this.views = views;
  }

  /** "Asha Rao" is shown as "Asha R."; reviews never show an email or a full surname. */
  static String displayName(String name) {
    String n = name == null ? "" : name.trim().replaceAll("\\s+", " ");
    if (n.isEmpty()) return "Customer";
    int sp = n.lastIndexOf(' ');
    if (sp < 0) return n;
    String last = n.substring(sp + 1);
    return n.substring(0, n.indexOf(' ')) + " " + last.substring(0, last.offsetByCodePoints(0, 1)).toUpperCase() + ".";
  }

  private void requireProduct(String productId) {
    boolean ok = jdbc.sql("select 1 from \"Product\" where id = :p").param("p", productId).query(Integer.class).optional().isPresent();
    if (!ok) throw ApiException.notFound("Product not found");
  }

  public boolean hasReceived(String userId, String productId) {
    return jdbc.sql("""
            select 1 from "OrderItem" i join "Order" o on o.id = i."orderId"
            where o."userId" = :u and i."productId" = :p and o.status::text = 'DELIVERED' limit 1
            """).param("u", userId).param("p", productId).query(Integer.class).optional().isPresent();
  }

  private Map<String, List<Photo>> photosFor(List<String> reviewIds) {
    Map<String, List<Photo>> out = new HashMap<>();
    if (reviewIds.isEmpty()) return out;
    jdbc.sql("select id, \"reviewId\", url from \"ReviewImage\" where \"reviewId\" in (:ids) order by position, id").param("ids", reviewIds)
        .query((rs, n) -> Map.entry(rs.getString(2), new Photo(rs.getInt(1), views.publicUrl(rs.getString(3))))).list()
        .forEach(e -> out.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
    return out;
  }

  private record Row(String id, int rating, String title, String body, String authorName, String status, LocalDateTime createdAt, String reply,
      LocalDateTime repliedAt) {}

  private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new Row(rs.getString("id"), rs.getInt("rating"), rs.getString("title"), rs.getString("body"), rs.getString("name"), rs.getString("status"),
        rs.getObject("createdAt", LocalDateTime.class), rs.getString("reply"), rs.getObject("repliedAt", LocalDateTime.class));
  }

  private List<ReviewView> toViews(List<Row> rows) {
    Map<String, List<Photo>> photos = photosFor(rows.stream().map(Row::id).toList());
    return rows.stream().map(r -> new ReviewView(r.id(), r.rating(), r.title(), r.body(), displayName(r.authorName()), true, r.createdAt(),
        photos.getOrDefault(r.id(), List.of()), r.reply(), r.repliedAt())).toList();
  }

  private static final String SELECT = "select r.id, r.rating, r.title, r.body, u.name, r.status, r.\"createdAt\", r.reply, r.\"repliedAt\"";

  @Transactional(readOnly = true)
  public ReviewPage list(String productId, String sort, int limit, int offset) {
    requireProduct(productId);
    String order = switch (sort == null ? "" : sort) {
      case "highest" -> "r.rating desc, r.\"createdAt\" desc, r.id";
      case "lowest" -> "r.rating asc, r.\"createdAt\" desc, r.id";
      default -> "r.\"createdAt\" desc, r.id";
    };
    List<Row> rows = jdbc.sql(SELECT + " from \"Review\" r join \"User\" u on u.id = r.\"userId\" where r.\"productId\" = :p and r.status = 'PUBLISHED' order by "
            + order + " limit :limit offset :offset")
        .param("p", productId).param("limit", limit).param("offset", offset).query((rs, n) -> row(rs)).list();
    Map<String, Long> hist = new LinkedHashMap<>();
    for (int i = 5; i >= 1; i--) hist.put(String.valueOf(i), 0L);
    jdbc.sql("select rating, count(*) from \"Review\" where \"productId\" = :p and status = 'PUBLISHED' group by rating").param("p", productId)
        .query((rs, n) -> Map.entry(String.valueOf(rs.getInt(1)), rs.getLong(2))).list().forEach(e -> hist.put(e.getKey(), e.getValue()));
    long count = hist.values().stream().mapToLong(Long::longValue).sum();
    double avg = count == 0 ? 0 : Math.round(hist.entrySet().stream().mapToDouble(e -> Integer.parseInt(e.getKey()) * (double) e.getValue()).sum() / count * 10) / 10.0;
    return new ReviewPage(new Summary(avg, count, hist), count, toViews(rows), (long) offset + rows.size() < count);
  }

  @Transactional(readOnly = true)
  public Mine mine(AppUser user, String productId) {
    requireProduct(productId);
    Row r = jdbc.sql(SELECT + " from \"Review\" r join \"User\" u on u.id = r.\"userId\" where r.\"productId\" = :p and r.\"userId\" = :u")
        .param("p", productId).param("u", user.id).query((rs, n) -> row(rs)).optional().orElse(null);
    boolean can = r != null || hasReceived(user.id, productId);
    return new Mine(r == null ? null : toViews(List.of(r)).get(0), r == null ? null : r.status(), can, can ? null : CANNOT);
  }

  /** Creates the review, or updates the caller's existing one (keeping its photos and any hidden status). */
  @Transactional
  public Mine save(AppUser user, String productId, int rating, String title, String body) {
    requireProduct(productId);
    String cleanTitle = title == null || title.isBlank() ? null : title.trim();
    int changed = jdbc.sql("""
            update "Review" set rating = :r, title = :t, body = :b, "updatedAt" = :now where "productId" = :p and "userId" = :u
            """).param("r", rating).param("t", cleanTitle).param("b", body).param("now", Time.now()).param("p", productId).param("u", user.id).update();
    if (changed == 0) {
      if (!hasReceived(user.id, productId)) throw ApiException.forbidden(CANNOT);
      jdbc.sql("""
              insert into "Review" (id, "productId", "userId", rating, title, body, "createdAt", "updatedAt") values (:id, :p, :u, :r, :t, :b, :now, :now)
              """).param("id", Ids.newId()).param("p", productId).param("u", user.id).param("r", rating).param("t", cleanTitle).param("b", body)
          .param("now", Time.now()).update();
    }
    return mine(user, productId);
  }

  @Transactional
  public void delete(AppUser user, String productId) {
    String id = ownReviewId(user, productId);
    List<String> urls = jdbc.sql("select url from \"ReviewImage\" where \"reviewId\" = :r").param("r", id).query(String.class).list();
    jdbc.sql("delete from \"Review\" where id = :id").param("id", id).update();
    urls.forEach(storage::remove);
  }

  private String ownReviewId(AppUser user, String productId) {
    return jdbc.sql("select id from \"Review\" where \"productId\" = :p and \"userId\" = :u").param("p", productId).param("u", user.id).query(String.class).optional()
        .orElseThrow(() -> ApiException.notFound("You have not reviewed this product"));
  }

  @Transactional
  public Mine addPhoto(AppUser user, String productId, byte[] file) {
    if (file == null) throw ApiException.badRequest("Attach an image in the \"file\" field");
    String id;
    try {
      id = ownReviewId(user, productId);
    } catch (ApiException e) {
      throw ApiException.badRequest("Write your review first, then add photos to it");
    }
    long have = jdbc.sql("select count(*) from \"ReviewImage\" where \"reviewId\" = :r").param("r", id).query(Long.class).single();
    if (have >= MAX_PHOTOS) throw ApiException.badRequest("A review can have at most " + MAX_PHOTOS + " photos");
    String url = storage.save(file);
    try {
      jdbc.sql("insert into \"ReviewImage\" (\"reviewId\", url, position) values (:r, :u, :pos)").param("r", id).param("u", url).param("pos", (int) have).update();
    } catch (RuntimeException e) {
      storage.remove(url);
      throw e;
    }
    return mine(user, productId);
  }

  @Transactional
  public Mine removePhoto(AppUser user, String productId, int imageId) {
    String id = ownReviewId(user, productId);
    String url = jdbc.sql("select url from \"ReviewImage\" where id = :i and \"reviewId\" = :r").param("i", imageId).param("r", id).query(String.class).optional()
        .orElseThrow(() -> ApiException.notFound("Photo not found"));
    jdbc.sql("delete from \"ReviewImage\" where id = :i").param("i", imageId).update();
    storage.remove(url);
    return mine(user, productId);
  }

  // ───────────── admin ─────────────

  @Transactional(readOnly = true)
  public AdminPage adminList(String status, Integer rating, String q, int limit, int offset) {
    return adminQuery(status, rating, q, null, limit, offset);
  }

  private AdminPage adminQuery(String status, Integer rating, String q, String onlyId, int limit, int offset) {
    StringBuilder where = new StringBuilder(" where 1 = 1");
    Map<String, Object> params = new LinkedHashMap<>();
    if (status != null && !status.isBlank()) {
      if (!status.equals("PUBLISHED") && !status.equals("HIDDEN")) throw ApiException.badRequest("status must be PUBLISHED or HIDDEN");
      where.append(" and r.status = :status");
      params.put("status", status);
    }
    if (rating != null) {
      where.append(" and r.rating = :rating");
      params.put("rating", rating);
    }
    if (onlyId != null) {
      where.append(" and r.id = :onlyId");
      params.put("onlyId", onlyId);
    }
    String text = q == null ? "" : q.trim().toLowerCase();
    if (!text.isEmpty()) {
      where.append(" and (lower(p.name) like :like escape '\\' or lower(u.name) like :like escape '\\' or lower(u.email) like :like escape '\\' or lower(r.body) like :like escape '\\')");
      params.put("like", "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
    }
    String from = " from \"Review\" r join \"Product\" p on p.id = r.\"productId\" join \"User\" u on u.id = r.\"userId\"";
    var count = jdbc.sql("select count(*)" + from + where);
    params.forEach(count::param);
    long total = count.query(Long.class).single();
    var rows = jdbc.sql("select r.id, r.\"productId\", p.name as pname, u.name as uname, u.email, r.rating, r.title, r.body, r.status, r.reply, r.\"repliedAt\", r.\"createdAt\""
        + from + where + " order by r.\"createdAt\" desc, r.id limit :limit offset :offset");
    params.forEach(rows::param);
    var raw = rows.param("limit", limit).param("offset", offset).query((rs, n) -> new Object[] {rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
        rs.getString(5), rs.getInt(6), rs.getString(7), rs.getString(8), rs.getString(9), rs.getString(10), rs.getObject(11, LocalDateTime.class),
        rs.getObject(12, LocalDateTime.class)}).list();
    Map<String, List<Photo>> photos = photosFor(raw.stream().map(o -> (String) o[0]).toList());
    List<AdminRow> items = raw.stream().map(o -> new AdminRow((String) o[0], (String) o[1], (String) o[2], (String) o[3], (String) o[4], (Integer) o[5], (String) o[6],
        (String) o[7], (String) o[8], (String) o[9], (LocalDateTime) o[10], (LocalDateTime) o[11], photos.getOrDefault((String) o[0], List.of()))).toList();
    Map<String, Long> counts = new LinkedHashMap<>();
    counts.put("PUBLISHED", 0L);
    counts.put("HIDDEN", 0L);
    jdbc.sql("select status, count(*) from \"Review\" group by status").query((rs, n) -> Map.entry(rs.getString(1), rs.getLong(2))).list().forEach(e -> counts.put(e.getKey(), e.getValue()));
    return new AdminPage(total, items, (long) offset + items.size() < total, counts);
  }

  /** Hide or show a review and/or set the shop's reply (an empty reply removes it). */
  @Transactional
  public AdminRow adminUpdate(String id, String status, String reply, boolean replyGiven) {
    if (status != null && !status.equals("PUBLISHED") && !status.equals("HIDDEN")) throw ApiException.badRequest("status must be PUBLISHED or HIDDEN");
    jdbc.sql("select id from \"Review\" where id = :id for update").param("id", id).query(String.class).optional().orElseThrow(() -> ApiException.notFound("Review not found"));
    if (status != null) jdbc.sql("update \"Review\" set status = :s where id = :id").param("s", status).param("id", id).update();
    if (replyGiven) {
      String clean = reply == null || reply.isBlank() ? null : reply.trim();
      jdbc.sql("update \"Review\" set reply = :r, \"repliedAt\" = :t where id = :id").param("r", clean).param("t", clean == null ? null : Time.now()).param("id", id).update();
    }
    return adminQuery(null, null, null, id, 1, 0).items().get(0);
  }

  @Transactional
  public void adminDelete(String id) {
    List<String> urls = jdbc.sql("select url from \"ReviewImage\" where \"reviewId\" = :r").param("r", id).query(String.class).list();
    int n = jdbc.sql("delete from \"Review\" where id = :id").param("id", id).update();
    if (n == 0) throw ApiException.notFound("Review not found");
    urls.forEach(storage::remove);
  }
}
