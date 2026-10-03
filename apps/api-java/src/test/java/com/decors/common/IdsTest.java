package com.decors.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import org.junit.jupiter.api.Test;

class IdsTest {
  @Test
  void idsAreUniqueUrlSafeAndShort() {
    var seen = new HashSet<String>();
    for (int i = 0; i < 50_000; i++) {
      String id = Ids.newId();
      assertTrue(id.matches("c[0-9a-z]{18,30}"), id);
      seen.add(id);
    }
    assertEquals(50_000, seen.size());
  }
}
