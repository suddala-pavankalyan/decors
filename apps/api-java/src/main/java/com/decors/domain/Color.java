package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Public fields are read directly, so this entity must never be replaced by a lazy proxy (proxies do not fill them in). */
@org.hibernate.annotations.Proxy(lazy = false)
@Entity
@Table(name = "Color")
public class Color {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Integer id;
  public String name;
  public String hex;
}
