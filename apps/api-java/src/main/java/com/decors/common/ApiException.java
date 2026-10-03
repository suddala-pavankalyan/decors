package com.decors.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** An error that should be shown to the caller, with the HTTP status to use. */
public class ApiException extends RuntimeException {
  private final HttpStatus status;
  private final Map<String, Object> extra;

  public ApiException(HttpStatus status, String message) {
    this(status, message, Map.of());
  }

  public ApiException(HttpStatus status, String message, Map<String, Object> extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }

  public HttpStatus status() { return status; }
  public Map<String, Object> extra() { return extra; }

  public static ApiException badRequest(String m) { return new ApiException(HttpStatus.BAD_REQUEST, m); }
  public static ApiException unauthorized() { return new ApiException(HttpStatus.UNAUTHORIZED, "Unauthorized"); }
  public static ApiException unauthorized(String m) { return new ApiException(HttpStatus.UNAUTHORIZED, m); }
  public static ApiException forbidden(String m) { return new ApiException(HttpStatus.FORBIDDEN, m); }
  public static ApiException notFound(String m) { return new ApiException(HttpStatus.NOT_FOUND, m); }
  public static ApiException conflict(String m) { return new ApiException(HttpStatus.CONFLICT, m); }
  public static ApiException tooMany(String m) { return new ApiException(HttpStatus.TOO_MANY_REQUESTS, m); }
  public static ApiException unavailable(String m) { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, m); }
  public static ApiException badGateway(String m) { return new ApiException(HttpStatus.BAD_GATEWAY, m); }
  public static ApiException unsupportedMedia(String m) { return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, m); }
}
