package com.decors.security;

import java.lang.annotation.*;

/** Injects the logged-in {@code AppUser} into a controller method. Only valid on {@code @Authenticated} handlers. */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
  String ATTRIBUTE = "decors.currentUser";
}
