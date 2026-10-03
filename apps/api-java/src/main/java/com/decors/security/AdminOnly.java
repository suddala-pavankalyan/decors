package com.decors.security;

import java.lang.annotation.*;

/** The caller must be logged in AND be an admin (checked against the database on every request). */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AdminOnly {}
