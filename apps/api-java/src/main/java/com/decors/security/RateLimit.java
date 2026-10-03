package com.decors.security;

import java.lang.annotation.*;

/** Per-IP limit for one endpoint (fixed window). Endpoints without it use the default of 300 per minute. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
  int limit();

  int seconds() default 60;
}
