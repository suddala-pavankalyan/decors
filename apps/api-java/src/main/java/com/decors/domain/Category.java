package com.decors.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public enum Category {
  WEDDING_CARDS, GIFT_CARDS, WALL_DECOR, PAINTS;

  /** "wedding-cards": the form used in URLs and JSON. */
  public String slug() {
    return name().toLowerCase().replace('_', '-');
  }

  public static Optional<Category> fromSlug(String s) {
    return Arrays.stream(values()).filter(c -> c.slug().equals(s)).findFirst();
  }

  public static List<String> slugs() {
    return Arrays.stream(values()).map(Category::slug).toList();
  }
}
