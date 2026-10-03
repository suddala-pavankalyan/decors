package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A line of an order. Name and price are copied at purchase time so later catalog edits don't rewrite history. */
@Entity
@Table(name = "OrderItem")
public class OrderItem {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Integer id;
  public String orderId;
  public String productId;
  public String name;
  public int unitPricePaise;
  public int qty;
  /** Category when it was bought (null if unknown). */
  @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING) @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.NAMED_ENUM)
  public Category category;
}
