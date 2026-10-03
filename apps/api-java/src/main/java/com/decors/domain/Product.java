package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Public fields are read directly, so this entity must never be replaced by a lazy proxy (proxies do not fill them in). */
@org.hibernate.annotations.Proxy(lazy = false)
@Entity
@Table(name = "Product")
public class Product {
  @Id
  public String id;
  public String name;
  @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  public Category category;
  public int price;
  /** Units available to buy. Reserved at checkout, given back when an order is cancelled. */
  public int stock;
  /** Customers can add their own names, date and venue (wedding cards). */
  public boolean personalizable;
  /** The kind of option this product comes in ("Size"); null when it has none. Options live in ProductVariant. */
  public String variantLabel;
  /** Average of the published reviews (kept by the database); 0 until there is one. */
  public double rating;
  public int reviewCount;
  public String description;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "colorId")
  public Color color;
  // Prisma's implicit many-to-many table: A = Product id, B = Tag id.
  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(name = "_ProductToTag", joinColumns = @JoinColumn(name = "A"), inverseJoinColumns = @JoinColumn(name = "B"))
  public Set<Tag> tags = new LinkedHashSet<>();
  public LocalDateTime createdAt;
}
