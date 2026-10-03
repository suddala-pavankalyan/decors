package com.decors.security;

import java.lang.annotation.*;

/** The caller must be logged in (valid, current login cookie). */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Authenticated {}
