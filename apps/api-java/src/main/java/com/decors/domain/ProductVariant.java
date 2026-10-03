package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** One option of a product ("A4", "4 L") with its own price (rupees) and stock. */
@Entity
@Table(name = "ProductVariant")
public class ProductVariant {
  @Id
  public String id;
  public String productId;
  public String label;
  public int price;
  public int stock;
  public int position;
  public boolean active = true;
  public LocalDateTime createdAt;
}
