package com.decors.web;

import com.decors.config.AppProperties;
import com.decors.domain.AppUser;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.security.JwtService;
import com.decors.security.RateLimit;
import com.decors.service.AuthService;
import com.decors.web.dto.AuthDtos;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {
  private final AuthService auth;
  private final AppProperties props;

  public AuthController(AuthService auth, AppProperties props) {
    this.auth = auth;
    this.props = props;
  }

  private ResponseCookie.ResponseCookieBuilder cookie(String value) {
    return ResponseCookie.from(JwtService.COOKIE, value)
        .httpOnly(true).sameSite("Lax").secure(props.production()).path("/");
  }

  private Map<String, Object> startSession(AuthService.Session s, HttpServletResponse res) {
    res.addHeader(HttpHeaders.SET_COOKIE, cookie(s.token()).maxAge(Duration.ofSeconds(JwtService.TTL_SECONDS)).build().toString());
    return s.user();
  }

  // Brute-force protection: 10 attempts per minute per IP on credential endpoints.
  @PostMapping("/register") @RateLimit(limit = 10) @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> register(@Valid @RequestBody AuthDtos.Register dto, HttpServletResponse res) {
    return startSession(auth.register(dto), res);
  }

  @PostMapping("/login") @RateLimit(limit = 10)
  public Map<String, Object> login(@Valid @RequestBody AuthDtos.Login dto, HttpServletResponse res) {
    return startSession(auth.login(dto), res);
  }

  @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(HttpServletResponse res) {
    res.addHeader(HttpHeaders.SET_COOKIE, cookie("").maxAge(Duration.ZERO).build().toString());
  }

  @GetMapping("/me") @Authenticated
  public Map<String, Object> me(@CurrentUser AppUser user) {
    return auth.me(user);
  }

  @PatchMapping("/me") @Authenticated
  public Map<String, Object> updateProfile(@CurrentUser AppUser user, @Valid @RequestBody AuthDtos.UpdateProfile dto) {
    return auth.updateProfile(user, dto);
  }

  @PostMapping("/change-password") @Authenticated @RateLimit(limit = 10)
  public Map<String, Object> changePassword(@CurrentUser AppUser user, @Valid @RequestBody AuthDtos.ChangePassword dto,
      HttpServletResponse res) {
    return startSession(auth.changePassword(user, dto), res);
  }

  @PostMapping("/verify-email") @RateLimit(limit = 20)
  public Map<String, Object> verifyEmail(@Valid @RequestBody AuthDtos.Verify dto) {
    return auth.verifyEmail(dto.token());
  }

  @PostMapping("/resend-verification") @Authenticated @RateLimit(limit = 5)
  public Map<String, Object> resendVerification(@CurrentUser AppUser user) {
    return auth.resendVerification(user);
  }

  @PostMapping("/forgot-password") @RateLimit(limit = 5)
  public Map<String, Object> forgotPassword(@Valid @RequestBody AuthDtos.Forgot dto) {
    return auth.forgotPassword(dto.email());
  }

  @PostMapping("/reset-password") @RateLimit(limit = 10)
  public Map<String, Object> resetPassword(@Valid @RequestBody AuthDtos.Reset dto) {
    return auth.resetPassword(dto.token(), dto.newPassword());
  }
}
