package com.decors.service;

import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.domain.AuthToken;
import com.decors.domain.AuthTokenType;
import com.decors.repo.Repositories.AuthTokenRepository;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One-time emailed links. Only a SHA-256 hash of each token is stored, so a database leak yields no working links. */
@Service
public class TokenService {
  public static final long VERIFY_TTL_MS = 24L * 60 * 60 * 1000;
  public static final long RESET_TTL_MS = 60L * 60 * 1000;
  /** How soon a new email of the same kind may be requested for one account. */
  public static final long RESEND_COOLDOWN_MS = 60L * 1000;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final AuthTokenRepository tokens;
  private final EntityManager em;

  public TokenService(AuthTokenRepository tokens, EntityManager em) {
    this.tokens = tokens;
    this.em = em;
  }

  public static String hash(String raw) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  /** Creates a token and returns the raw value for the email link. Earlier unused tokens of the same kind stop working. */
  @Transactional
  public String issue(String userId, AuthTokenType type) {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    var now = Time.now();
    tokens.invalidateUnused(userId, type, now);
    tokens.deleteExpired(userId, now.minusDays(1)); // housekeeping
    AuthToken t = new AuthToken();
    t.id = Ids.newId();
    t.userId = userId;
    t.type = type;
    t.tokenHash = hash(raw);
    t.createdAt = now;
    t.expiresAt = Time.nowPlus(type == AuthTokenType.EMAIL_VERIFY ? VERIFY_TTL_MS : RESET_TTL_MS);
    em.persist(t);
    return raw;
  }

  /** True when a token of this kind was issued for the account less than a minute ago. */
  @Transactional(readOnly = true)
  public boolean onCooldown(String userId, AuthTokenType type) {
    return tokens.lastIssuedAt(userId, type)
        .map(last -> Time.now().isBefore(last.plusNanos(RESEND_COOLDOWN_MS * 1_000_000)))
        .orElse(false);
  }

  @Transactional(readOnly = true)
  public Optional<AuthToken> find(AuthTokenType type, String raw) {
    return tokens.findByTokenHash(hash(raw)).filter(t -> t.type == type);
  }
}
