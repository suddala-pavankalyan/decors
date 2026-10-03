package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ReviewNameTest {
  @Test
  void showsFirstNameAndLastInitial() {
    assertEquals("Asha R.", ReviewService.displayName("Asha Rao"));
    assertEquals("Priya", ReviewService.displayName("Priya"));
    assertEquals("Customer", ReviewService.displayName("   "));
    assertEquals("Customer", ReviewService.displayName(null));
  }

  @Test
  void usesTheLastWordAsTheInitialAndTidiesSpaces() {
    assertEquals("Asha K.", ReviewService.displayName("  Asha   M   kumar "));
    assertEquals("Ravi S.", ReviewService.displayName("Ravi Subramanian"));
  }
}
