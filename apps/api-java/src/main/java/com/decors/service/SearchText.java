package com.decors.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/** Splitting a search into words and fixing small typos against the catalogue's own vocabulary. */
final class SearchText {
  static final int MAX_TOKENS = 6;

  private SearchText() {}

  /** Lower-case words of a query (at most six), without punctuation. */
  static List<String> tokens(String q) {
    if (q == null) return List.of();
    List<String> out = new ArrayList<>();
    for (String w : words(List.of(q))) {
      if (out.size() == MAX_TOKENS) break;
      out.add(w);
    }
    return out;
  }

  static List<String> words(List<String> texts) {
    LinkedHashSet<String> out = new LinkedHashSet<>();
    for (String t : texts) {
      if (t == null) continue;
      for (String w : t.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
        if (!w.isEmpty()) out.add(w);
      }
    }
    return new ArrayList<>(out);
  }

  /**
   * Replaces each word that is not part of any known word with the closest known word within a small
   * edit distance (1 for short words, 2 for longer ones). Words with no close match stay as typed.
   */
  static List<String> correct(List<String> tokens, List<String> vocabulary) {
    List<String> out = new ArrayList<>();
    for (String t : tokens) {
      if (vocabulary.stream().anyMatch((v) -> v.contains(t))) { out.add(t); continue; }
      int max = t.length() <= 4 ? 1 : 2;
      String best = t;
      int bestD = max + 1;
      for (String v : vocabulary) {
        if (Math.abs(v.length() - t.length()) > max) continue;
        int d = distance(t, v, max);
        if (d < bestD) { bestD = d; best = v; }
      }
      out.add(t.length() < 3 ? t : best);
    }
    return out;
  }

  /** Damerau-style edit distance (a swap of two neighbours counts once); stops early beyond {@code cap}. */
  static int distance(String a, String b, int cap) {
    int[][] d = new int[a.length() + 1][b.length() + 1];
    for (int i = 0; i <= a.length(); i++) d[i][0] = i;
    for (int j = 0; j <= b.length(); j++) d[0][j] = j;
    for (int i = 1; i <= a.length(); i++) {
      int rowMin = Integer.MAX_VALUE;
      for (int j = 1; j <= b.length(); j++) {
        int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > cap) return cap + 1;
    }
    return d[a.length()][b.length()];
  }
}
