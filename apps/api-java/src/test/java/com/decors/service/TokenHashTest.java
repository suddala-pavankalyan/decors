package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class TokenHashTest {
  @Test
  void hashIsHexSha256() {
    assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", TokenService.hash("abc"));
    assertNotEquals(TokenService.hash("abc"), TokenService.hash("abd"));
  }
}
