package com.decors.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/**
 * Error responses in the same shape the NestJS API uses, so the website needs no changes:
 * {@code {"statusCode": 400, "message": "..." | ["..."], "error": "Bad Request"}}.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  static ResponseEntity<Map<String, Object>> body(HttpStatus status, Object message, Map<String, Object> extra) {
    Map<String, Object> b = new LinkedHashMap<>();
    b.put("statusCode", status.value());
    b.put("message", message);
    if (status != HttpStatus.UNAUTHORIZED && status != HttpStatus.TOO_MANY_REQUESTS) b.put("error", status.getReasonPhrase());
    b.putAll(extra);
    return ResponseEntity.status(status).body(b);
  }

  public static ResponseEntity<Map<String, Object>> of(HttpStatus status, Object message) {
    return body(status, message, Map.of());
  }

  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, Object>> api(ApiException e) {
    return body(e.status(), e.getMessage(), e.extra());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> invalidBody(MethodArgumentNotValidException e) {
    return of(HttpStatus.BAD_REQUEST, fieldMessages(e.getBindingResult().getFieldErrors()));
  }

  @ExceptionHandler(BindException.class)
  ResponseEntity<Map<String, Object>> invalidQuery(BindException e) {
    return of(HttpStatus.BAD_REQUEST, fieldMessages(e.getFieldErrors()));
  }

  private static List<String> fieldMessages(List<FieldError> errors) {
    return errors.stream()
        .map(fe -> fe.isBindingFailure() ? fe.getField() + " must be a valid value" : fe.getDefaultMessage())
        .distinct()
        .toList();
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Map<String, Object>> unreadable(HttpMessageNotReadableException e) {
    return of(HttpStatus.BAD_REQUEST, "The request body is missing, is not valid JSON, or has a value of the wrong type");
  }

  @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
  ResponseEntity<Map<String, Object>> badParam(Exception e) {
    return of(HttpStatus.BAD_REQUEST, "A request parameter is missing or has the wrong type");
  }

  @ExceptionHandler({MissingServletRequestPartException.class, org.springframework.web.multipart.MultipartException.class})
  ResponseEntity<Map<String, Object>> missingPart(Exception e) {
    return of(HttpStatus.BAD_REQUEST, "Attach an image in the \"file\" field");
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<Map<String, Object>> tooBig(MaxUploadSizeExceededException e) {
    return of(HttpStatus.PAYLOAD_TOO_LARGE, "File too large");
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  ResponseEntity<Map<String, Object>> mediaType(HttpMediaTypeNotSupportedException e) {
    return of(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type");
  }

  @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
  ResponseEntity<Map<String, Object>> notFound(Exception e, HttpServletRequest req) {
    return of(HttpStatus.NOT_FOUND, "Cannot " + req.getMethod() + " " + req.getRequestURI());
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unexpected(Exception e, HttpServletRequest req) {
    log.error("Unhandled error on {} {}", req.getMethod(), req.getRequestURI(), e);
    return of(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
  }
}
