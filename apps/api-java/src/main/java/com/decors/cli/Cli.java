package com.decors.cli;

import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.Category;
import com.decors.domain.Color;
import com.decors.domain.Product;
import com.decors.domain.ProductImage;
import com.decors.domain.Role;
import com.decors.domain.Tag;
import com.decors.repo.Repositories.ColorRepository;
import com.decors.repo.Repositories.ProductImageRepository;
import com.decors.repo.Repositories.ProductRepository;
import com.decors.repo.Repositories.TagRepository;
import com.decors.repo.Repositories.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * One-off commands, run as {@code java -jar decors-api.jar seed} or {@code ... make-admin you@example.com [--remove]}.
 * They exit with status 1 on failure so scripts can tell.
 */
@Component
@Profile("cli")
public class Cli implements ApplicationRunner {
  /** Exit status for the process; read by {@code DecorsApplication.main} after the context closes. */
  public static volatile int exitCode = 0;

  private record SeedProduct(String name, String category, int price, String color, String colorName,
      List<String> tags, double rating, String description) {}

  private final ProductRepository products;
  private final ColorRepository colors;
  private final TagRepository tags;
  private final ProductImageRepository images;
  private final UserRepository users;
  private final JdbcClient jdbc;
  private final TransactionTemplate tx;
  private final ObjectMapper json;

  public Cli(ProductRepository products, ColorRepository colors, TagRepository tags, ProductImageRepository images,
      UserRepository users, JdbcClient jdbc, TransactionTemplate tx, ObjectMapper json) {
    this.products = products;
    this.colors = colors;
    this.tags = tags;
    this.images = images;
    this.users = users;
    this.jdbc = jdbc;
    this.tx = tx;
    this.json = json;
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    List<String> a = args.getNonOptionArgs();
    String command = a.isEmpty() ? "" : a.get(0);
    switch (command) {
      case "seed" -> seed();
      case "make-admin" -> makeAdmin(a.size() > 1 ? a.get(1).trim().toLowerCase() : "", args.containsOption("remove"));
      default -> fail("Unknown command");
    }
  }

  private static void fail(String message) {
    System.err.println(message);
    exitCode = 1;
  }

  private void makeAdmin(String email, boolean demote) {
    if (email.isEmpty() || email.startsWith("--")) {
      fail("Usage: java -jar decors-api.jar make-admin you@example.com [--remove]");
      return;
    }
    boolean found = Boolean.TRUE.equals(tx.execute(s -> users.findByEmail(email).map(u -> {
      u.role = demote ? Role.USER : Role.ADMIN;
      return true;
    }).orElse(false)));
    if (!found) {
      fail("No account found for " + email + ". Sign up on the website first, then run this again.");
      return;
    }
    System.out.println(email + " is now " + (demote ? "a regular user" : "an admin") + ".");
  }

  private static String slug(String s) {
    return s.toLowerCase().replaceAll("[^a-z0-9]+", "-");
  }

  /** Replaces the whole catalogue with the sample products (the same ones the NestJS seed script creates). */
  private void seed() throws Exception {
    List<SeedProduct> data;
    try (InputStream in = getClass().getResourceAsStream("/seed/products.json")) {
      data = json.readValue(in, json.getTypeFactory().constructCollectionType(List.class, SeedProduct.class));
    }
    tx.executeWithoutResult(s -> {
      jdbc.sql("delete from \"Product\"").update(); // images, cart and wishlist rows cascade
      for (SeedProduct p : data) {
        Color color = colors.findFirstByNameIgnoreCase(p.colorName()).orElseGet(() -> {
          Color c = new Color();
          c.name = p.colorName();
          c.hex = p.color();
          return colors.saveAndFlush(c);
        });
        Product pr = new Product();
        pr.id = Ids.newId();
        pr.name = p.name();
        pr.category = Category.fromSlug(p.category()).orElseThrow();
        pr.price = p.price();
        pr.stock = 25;
        pr.personalizable = pr.category == Category.WEDDING_CARDS; // names, date and venue can go on wedding cards
        pr.rating = p.rating();
        pr.description = p.description();
        pr.color = color;
        pr.createdAt = Time.now();
        pr.tags = new LinkedHashSet<>();
        for (String name : p.tags()) {
          pr.tags.add(tags.findByName(name).orElseGet(() -> {
            Tag t = new Tag();
            t.name = name;
            return tags.saveAndFlush(t);
          }));
        }
        products.saveAndFlush(pr);
        if (pr.category == Category.PAINTS) {
          // Paints come in tins of different sizes (the product's price becomes the lowest option's).
          String[][] tins = {{"1 L", "1"}, {"4 L", "3"}, {"10 L", "7"}};
          int pos = 0;
          for (String[] t : tins) {
            jdbc.sql("insert into \"ProductVariant\" (id, \"productId\", label, price, stock, position) values (:id, :p, :l, :price, 25, :pos)")
                .param("id", Ids.newId()).param("p", pr.id).param("l", t[0]).param("price", pr.price * Integer.parseInt(t[1])).param("pos", pos++).update();
          }
          jdbc.sql("update \"Product\" set \"variantLabel\" = 'Size' where id = :p").param("p", pr.id).update();
        }
        for (int i = 0; i < 3; i++) {
          ProductImage img = new ProductImage();
          img.productId = pr.id;
          img.position = i;
          img.alt = p.name() + " – view " + (i + 1);
          // Placeholder photos; replace with real uploads (S3/Cloudinary) later.
          img.url = "https://picsum.photos/seed/" + slug(p.name()) + "-" + i + "/1200/900";
          images.save(img);
        }
      }
    });
    System.out.println("Seeded " + data.size() + " products");
  }
}
