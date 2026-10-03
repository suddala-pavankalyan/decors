package com.decors.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DotenvTest {
  private static Map<String, Object> parse(String... lines) {
    Map<String, Object> out = new LinkedHashMap<>();
    for (String l : lines) DotenvEnvironmentPostProcessor.parseLine(l, out);
    return out;
  }

  @Test
  void readsQuotedAndPlainValues() {
    var m = parse("A=plain", "B=\"quoted value\"", "C='single'", "export D=exported");
    assertEquals("plain", m.get("A"));
    assertEquals("quoted value", m.get("B"));
    assertEquals("single", m.get("C"));
    assertEquals("exported", m.get("D"));
  }

  @Test
  void dropsTrailingCommentsButKeepsHashesInsideValues() {
    var m = parse("JWT_SECRET=\"change-me\"   # generate one", "COLOR=#fff", "URL=http://x/#frag", "PLAIN=abc # note");
    assertEquals("change-me", m.get("JWT_SECRET"));
    assertEquals("#fff", m.get("COLOR"));
    assertEquals("http://x/#frag", m.get("URL"));
    assertEquals("abc", m.get("PLAIN"));
  }

  @Test
  void skipsBlankLinesCommentsAndGarbage() {
    var m = parse("", "   ", "# comment", "no equals sign", "=novalue");
    assertEquals(0, m.size());
  }

  @Test
  void convertsPrismaStyleDatabaseUrl() {
    var m = DotenvEnvironmentPostProcessor.toJdbc("postgresql://decors:s%40cret@db.example.com:6543/shop?schema=app&sslmode=require");
    assertEquals("jdbc:postgresql://db.example.com:6543/shop?currentSchema=app&sslmode=require", m.get("spring.datasource.url"));
    assertEquals("decors", m.get("spring.datasource.username"));
    assertEquals("s@cret", m.get("spring.datasource.password"));
  }

  @Test
  void acceptsPostgresSchemeAndJdbcUrls() {
    assertEquals("jdbc:postgresql://localhost/x", DotenvEnvironmentPostProcessor.toJdbc("postgres://u:p@localhost/x").get("spring.datasource.url"));
    var jdbc = DotenvEnvironmentPostProcessor.toJdbc("jdbc:postgresql://h/d");
    assertEquals("jdbc:postgresql://h/d", jdbc.get("spring.datasource.url"));
    assertFalse(jdbc.containsKey("spring.datasource.username"));
  }
}
