package com.decors.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.decors.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

class RateLimitInterceptorTest {
  static class Handlers {
    @RateLimit(limit = 2)
    public void strict() {}

    public void relaxed() {}
  }

  private static HandlerMethod handler(String name) throws Exception {
    Method m = Handlers.class.getMethod(name);
    return new HandlerMethod(new Handlers(), m);
  }

  private static HttpServletRequest from(String ip) {
    var r = new MockHttpServletRequest("POST", "/x");
    r.setRemoteAddr(ip);
    return r;
  }

  @Test
  void blocksAfterTheLimitPerClientAndHandler() throws Exception {
    var interceptor = new RateLimitInterceptor();
    var res = new MockHttpServletResponse();
    var strict = handler("strict");
    assertDoesNotThrow(() -> interceptor.preHandle(from("1.1.1.1"), res, strict));
    assertDoesNotThrow(() -> interceptor.preHandle(from("1.1.1.1"), res, strict));
    assertThrows(ApiException.class, () -> interceptor.preHandle(from("1.1.1.1"), res, strict));
    // another client, and another endpoint, are counted separately
    assertDoesNotThrow(() -> interceptor.preHandle(from("2.2.2.2"), res, strict));
    assertDoesNotThrow(() -> interceptor.preHandle(from("1.1.1.1"), res, handler("relaxed")));
  }
}
