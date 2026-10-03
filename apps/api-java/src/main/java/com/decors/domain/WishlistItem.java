package com.decors.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "WishlistItem")
public class WishlistItem {
  @EmbeddedId
  public CartItemId id;
  @ManyToOne(fetch = FetchType.LAZY) @MapsId("productId") @JoinColumn(name = "productId")
  public Product product;
  public LocalDateTime createdAt;
}
