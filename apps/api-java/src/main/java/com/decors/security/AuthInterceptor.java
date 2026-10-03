package com.decors.security;

import com.decors.common.ApiException;
import com.decors.domain.AppUser;
import com.decors.domain.Role;
import com.decors.repo.Repositories.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link Authenticated} / {@link AdminOnly}. A login is only good while its token version matches the
 * account's current one (it changes on every password change) and the account still exists. The role is read from
 * the database each time, so demoting an admin takes effect immediately.
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {
  private final JwtService jwt;
  private final UserRepository users;

  public AuthInterceptor(JwtService jwt, UserRepository users) {
    this.jwt = jwt;
    this.users = users;
  }

  @Override
  public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    if (!(handler instanceof HandlerMethod hm)) return true;
    boolean admin = has(hm, AdminOnly.class);
    if (!admin && !has(hm, Authenticated.class)) return true;

    String token = null;
    if (req.getCookies() != null) {
      for (Cookie c : req.getCookies()) {
        if (JwtService.COOKIE.equals(c.getName())) token = c.getValue();
      }
    }
    Claims claims = jwt.parse(token).orElseThrow(ApiException::unauthorized);
    Number tv = claims.get("tv", Number.class);
    AppUser user = users.findById(claims.getSubject()).orElseThrow(ApiException::unauthorized);
    if ((tv == null ? 0 : tv.intValue()) != user.tokenVersion) throw ApiException.unauthorized();
    if (admin && user.role != Role.ADMIN) throw ApiException.forbidden("Admin access required");
    req.setAttribute(CurrentUser.ATTRIBUTE, user);
    return true;
  }

  private static boolean has(HandlerMethod hm, Class<? extends java.lang.annotation.Annotation> a) {
    return hm.hasMethodAnnotation(a) || hm.getBeanType().isAnnotationPresent(a);
  }
}
