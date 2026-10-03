package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class SearchTextTest {
  private static final List<String> VOCAB = SearchText.words(List.of("Royal Blue Matt Paint 4L", "Wedding Cards", "gold", "Floral Wall Decor"));

  @Test
  void splitsIntoWords() {
    assertEquals(List.of("royal", "blue"), SearchText.tokens("  Royal,  BLUE! "));
    assertEquals(List.of(), SearchText.tokens(null));
    assertEquals(6, SearchText.tokens("a b c d e f g h").size());
  }

  @Test
  void fixesTypos() {
    assertEquals(List.of("wedding", "gold"), SearchText.correct(List.of("weding", "glod"), VOCAB));
    assertEquals(List.of("floral"), SearchText.correct(List.of("floarl"), VOCAB));
  }

  @Test
  void keepsKnownAndUnknownWords() {
    assertEquals(List.of("pai"), SearchText.correct(List.of("pai"), VOCAB));
    assertEquals(List.of("zzzzzz"), SearchText.correct(List.of("zzzzzz"), VOCAB));
  }
}
