package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Background;
import com.decors.common.Ids;
import com.decors.common.Time;
import com.decors.config.AppProperties;
import com.decors.domain.AppUser;
import com.decors.domain.AuthToken;
import com.decors.domain.AuthTokenType;
import com.decors.mail.MailerService;
import com.decors.mail.Templates;
import com.decors.repo.Repositories.AuthTokenRepository;
import com.decors.repo.Repositories.UserRepository;
import com.decors.security.JwtService;
import com.decors.web.dto.AuthDtos;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private static final Logger log = LoggerFactory.getLogger(AuthService.class);
  private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder(10);
  // Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
  private static final String DUMMY_HASH = BCRYPT.encode("not-a-real-password");

  public record Session(Map<String, Object> user, String token) {}

  private final UserRepository users;
  private final AuthTokenRepository authTokens;
  private final TokenService tokens;
  private final JwtService jwt;
  private final MailerService mailer;
  private final Background background;
  private final AppProperties props;

  public AuthService(UserRepository users, AuthTokenRepository authTokens, TokenService tokens, JwtService jwt,
      MailerService mailer, Background background, AppProperties props) {
    this.users = users;
    this.authTokens = authTokens;
    this.tokens = tokens;
    this.jwt = jwt;
    this.mailer = mailer;
    this.background = background;
    this.props = props;
  }

  public static Map<String, Object> toPublic(AppUser u) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", u.id);
    m.put("email", u.email);
    m.put("name", u.name);
    m.put("role", u.role.name());
    m.put("createdAt", Time.ISO.format(u.createdAt));
    m.put("emailVerified", u.emailVerifiedAt != null);
    return m;
  }

  private Session issue(AppUser u) {
    return new Session(toPublic(u), jwt.sign(u.id, u.tokenVersion));
  }

  public Session register(AuthDtos.Register dto) {
    AppUser u = new AppUser();
    u.id = Ids.newId();
    u.email = dto.email();
    u.name = dto.name();
    u.passwordHash = BCRYPT.encode(dto.password());
    u.createdAt = Time.now();
    try {
      u = users.saveAndFlush(u);
    } catch (DataIntegrityViolationException e) {
      throw ApiException.conflict("An account with this email already exists");
    }
    // Don't make signup wait for (or fail because of) the mail server.
    sendVerificationEmailInBackground(u);
    return issue(u);
  }

  public Session login(AuthDtos.Login dto) {
    AppUser u = users.findByEmail(dto.email()).orElse(null);
    boolean ok = BCRYPT.matches(dto.password(), u == null ? DUMMY_HASH : u.passwordHash);
    if (u == null || !ok) throw ApiException.unauthorized("Invalid email or password");
    return issue(u);
  }

  public Map<String, Object> me(AppUser u) {
    return toPublic(u);
  }

  @Transactional
  public Map<String, Object> updateProfile(AppUser u, AuthDtos.UpdateProfile dto) {
    AppUser fresh = users.findById(u.id).orElseThrow(ApiException::unauthorized);
    fresh.name = dto.name();
    return toPublic(fresh);
  }

  /** Changes the password and signs out every other session (by bumping tokenVersion); returns a fresh token. */
  @Transactional
  public Session changePassword(AppUser current, AuthDtos.ChangePassword dto) {
    AppUser u = users.findById(current.id).orElseThrow(ApiException::unauthorized);
    if (!BCRYPT.matches(dto.currentPassword(), u.passwordHash)) {
      throw ApiException.badRequest("Your current password is incorrect");
    }
    if (dto.currentPassword().equals(dto.newPassword())) {
      throw ApiException.badRequest("Choose a new password that is different from the current one");
    }
    u.passwordHash = BCRYPT.encode(dto.newPassword());
    u.tokenVersion += 1;
    return issue(u);
  }

  // ───────────── email verification ─────────────

  private void sendVerificationEmail(AppUser u) {
    String raw = tokens.issue(u.id, AuthTokenType.EMAIL_VERIFY);
    mailer.send(Templates.verifyEmail(u.email, u.name, props.webUrl() + "/verify-email?token=" + raw));
  }

  private void sendVerificationEmailInBackground(AppUser u) {
    background.run("Sending the verification email", () -> sendVerificationEmail(u));
  }

  public Map<String, Object> resendVerification(AppUser current) {
    AppUser u = users.findById(current.id).orElseThrow(ApiException::unauthorized);
    if (u.emailVerifiedAt != null) return Map.of("alreadyVerified", true);
    if (tokens.onCooldown(u.id, AuthTokenType.EMAIL_VERIFY)) {
      throw ApiException.tooMany("We just sent you an email. Please wait a minute before asking for another.");
    }
    try {
      sendVerificationEmail(u);
    } catch (RuntimeException e) {
      log.error("Could not send the verification email: {}", e.getMessage());
      throw ApiException.unavailable("We could not send the email right now. Please try again in a few minutes.");
    }
    return Map.of("alreadyVerified", false);
  }

  /** The person opened the link in their email and pressed the button. */
  @Transactional
  public Map<String, Object> verifyEmail(String raw) {
    var invalid = ApiException.badRequest("This link is invalid or has expired. Request a new one from your profile.");
    AuthToken t = tokens.find(AuthTokenType.EMAIL_VERIFY, raw).orElseThrow(() -> invalid);
    AppUser u = users.findById(t.userId).orElseThrow(() -> invalid);
    if (t.usedAt != null) {
      // Opening the same link twice is fine once the address is confirmed; a replaced link is not.
      if (u.emailVerifiedAt != null) return Map.of("verified", true);
      throw invalid;
    }
    if (Time.isPast(t.expiresAt)) throw invalid;
    AuthToken managed = authTokens.findById(t.id).orElseThrow(() -> invalid);
    managed.usedAt = Time.now();
    if (u.emailVerifiedAt == null) u.emailVerifiedAt = Time.now();
    return Map.of("verified", true);
  }

  // ───────────── password reset ─────────────

  /**
   * Always answers the same way, whether or not the address has an account, so this cannot be used to find out who is
   * registered. The real work happens after the response goes out, so timing does not leak either.
   */
  public Map<String, Object> forgotPassword(String email) {
    background.run("Sending the reset email", () -> sendResetEmail(email));
    return Map.of("ok", true);
  }

  private void sendResetEmail(String email) {
    AppUser u = users.findByEmail(email).orElse(null);
    if (u == null) return;
    if (tokens.onCooldown(u.id, AuthTokenType.PASSWORD_RESET)) return; // no email bombing
    String raw = tokens.issue(u.id, AuthTokenType.PASSWORD_RESET);
    mailer.send(Templates.resetPassword(u.email, u.name, props.webUrl() + "/reset-password?token=" + raw));
  }

  @Transactional
  public Map<String, Object> resetPassword(String raw, String newPassword) {
    var invalid = ApiException.badRequest("This reset link is invalid or has expired. Please request a new one.");
    AuthToken t = tokens.find(AuthTokenType.PASSWORD_RESET, raw).orElseThrow(() -> invalid);
    if (t.usedAt != null || Time.isPast(t.expiresAt)) throw invalid;
    AppUser u = users.findById(t.userId).orElseThrow(() -> invalid);
    var now = Time.now();
    // Single use, and any other outstanding reset links die with it.
    authTokens.invalidateUnused(u.id, AuthTokenType.PASSWORD_RESET, now);
    u.passwordHash = BCRYPT.encode(newPassword);
    u.tokenVersion += 1; // signs out every device
    if (u.emailVerifiedAt == null) u.emailVerifiedAt = now; // they proved they own the inbox
    String email = u.email;
    String name = u.name;
    background.run("Sending the password-changed notice", () ->
        mailer.send(Templates.passwordChanged(email, name, props.webUrl() + "/forgot-password")));
    return Map.of("ok", true);
  }
}
