package com.decors.config;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Makes configuration work the same way as the NestJS API:
 * <ul>
 *   <li>reads a {@code .env} file from the working directory (real environment variables always win), and</li>
 *   <li>turns {@code DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public} into the JDBC settings Spring needs,
 *       so the same connection string works for both backends.</li>
 * </ul>
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication app) {
    Map<String, Object> props = new LinkedHashMap<>();

    Path file = Path.of(".env");
    if (Files.isRegularFile(file)) {
      try {
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
          parseLine(line, props);
        }
      } catch (IOException e) {
        throw new IllegalStateException("Could not read .env", e);
      }
    }
    // Anything already defined as a real environment variable or system property keeps its value.
    props.keySet().removeIf(k -> env.getSystemEnvironment().containsKey(k) || env.getSystemProperties().containsKey(k));
    if (!props.isEmpty()) {
      env.getPropertySources().addLast(new MapPropertySource("dotenv", props));
    }

    // Database settings, unless the Spring-style ones were given explicitly.
    if (env.getProperty("SPRING_DATASOURCE_URL") == null) {
      String raw = env.getProperty("DATABASE_URL", "postgresql://decors:decors@localhost:5432/decors?schema=public");
      Map<String, Object> db = new LinkedHashMap<>(toJdbc(raw));
      env.getPropertySources().addLast(new MapPropertySource("decors-database", db));
    }
  }

  static void parseLine(String line, Map<String, Object> out) {
    String s = line.strip();
    if (s.isEmpty() || s.startsWith("#")) return;
    if (s.startsWith("export ")) s = s.substring(7).strip();
    int eq = s.indexOf('=');
    if (eq <= 0) return;
    String key = s.substring(0, eq).strip();
    String value = s.substring(eq + 1).strip();
    if (!value.isEmpty() && (value.charAt(0) == '"' || value.charAt(0) == '\'')) {
      char quote = value.charAt(0);
      int end = value.indexOf(quote, 1);
      value = end > 0 ? value.substring(1, end) : value.substring(1); // anything after the closing quote is a comment
    } else {
      int hash = value.indexOf(" #");
      if (hash >= 0) value = value.substring(0, hash).strip();
    }
    out.put(key, value);
  }

  /** {@code postgresql://user:pass@host:5432/db?schema=public} (or already {@code jdbc:...}) to Spring datasource properties. */
  static Map<String, String> toJdbc(String raw) {
    Map<String, String> out = new LinkedHashMap<>();
    if (raw.startsWith("jdbc:")) {
      out.put("spring.datasource.url", raw);
      return out;
    }
    URI uri = URI.create(raw.replaceFirst("^postgres(ql)?://", "postgresql://"));
    String userInfo = uri.getRawUserInfo();
    if (userInfo != null) {
      int colon = userInfo.indexOf(':');
      String user = colon >= 0 ? userInfo.substring(0, colon) : userInfo;
      String pass = colon >= 0 ? userInfo.substring(colon + 1) : "";
      out.put("spring.datasource.username", URLDecoder.decode(user, StandardCharsets.UTF_8));
      out.put("spring.datasource.password", URLDecoder.decode(pass, StandardCharsets.UTF_8));
    }
    StringBuilder url = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
    if (uri.getPort() > 0) url.append(':').append(uri.getPort());
    url.append(uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/decors" : uri.getRawPath());
    List<String> params = new java.util.ArrayList<>();
    if (uri.getRawQuery() != null) {
      for (String p : uri.getRawQuery().split("&")) {
        if (p.startsWith("schema=")) params.add("currentSchema=" + p.substring(7)); // Prisma's name for it
        else if (!p.isBlank()) params.add(p);
      }
    }
    if (!params.isEmpty()) url.append('?').append(String.join("&", params));
    out.put("spring.datasource.url", url.toString());
    return out;
  }
}
