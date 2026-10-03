package com.decors.security;

import com.decors.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

/**
 * Login tokens: HS256 JWT with {@code sub} (user id) and {@code tv} (token version), valid for 7 days.
 * The format matches the NestJS API, so with the same JWT_SECRET a login from one backend works on the other.
 */
@Component
public class JwtService {
  public static final String COOKIE = "decors_token";
  public static final long TTL_SECONDS = 7L * 24 * 60 * 60;

  private final SecretKey key;

  public JwtService(AppProperties props) {
    String secret = props.jwtSecret();
    if (secret == null || secret.length() < 32) {
      throw new IllegalStateException("JWT_SECRET must be set to a random string of at least 32 characters");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  public String sign(String userId, int tokenVersion) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .subject(userId)
        .claim("tv", tokenVersion)
        .issuedAt(new Date(now))
        .expiration(new Date(now + TTL_SECONDS * 1000))
        .signWith(key, Jwts.SIG.HS256)
        .compact();
  }

  /** Empty if the token is missing, forged, malformed or expired. */
  public Optional<Claims> parse(String token) {
    if (token == null || token.isBlank()) return Optional.empty();
    try {
      return Optional.of(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload());
    } catch (JwtException | IllegalArgumentException e) {
      return Optional.empty();
    }
  }
}
