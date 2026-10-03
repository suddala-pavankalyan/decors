package com.decors.security;

import com.decors.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Per-IP, per-endpoint request limits (fixed window, kept in memory). */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {
  static final int DEFAULT_LIMIT = 300;
  static final int DEFAULT_SECONDS = 60;
  /** The exact text the NestJS API sends, which the website already knows how to show nicely. */
  public static final String MESSAGE = "ThrottlerException: Too Many Requests";

  private static final class Window {
    long start;
    int count;
  }

  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

  @Override
  public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    if (!(handler instanceof HandlerMethod hm)) return true;
    RateLimit rl = hm.getMethodAnnotation(RateLimit.class);
    int limit = rl != null ? rl.limit() : DEFAULT_LIMIT;
    int seconds = rl != null ? rl.seconds() : DEFAULT_SECONDS;
    if (!allow(hm.getBeanType().getSimpleName() + "#" + hm.getMethod().getName() + "|" + req.getRemoteAddr(), limit, seconds * 1000L)) {
      throw ApiException.tooMany(MESSAGE);
    }
    return true;
  }

  boolean allow(String key, int limit, long windowMillis) {
    long now = System.currentTimeMillis();
    if (windows.size() > 20_000) windows.values().removeIf(w -> now - w.start > 120_000);
    Window w = windows.computeIfAbsent(key, k -> new Window());
    synchronized (w) {
      if (now - w.start >= windowMillis) {
        w.start = now;
        w.count = 0;
      }
      return ++w.count <= limit;
    }
  }
}
