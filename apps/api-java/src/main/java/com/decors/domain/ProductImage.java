package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "ProductImage")
public class ProductImage {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Integer id;
  /** "/uploads/<uuid>.jpg" for our own uploads, or a full URL for external images. */
  public String url;
  public String alt;
  public int position;
  public String productId;
}
