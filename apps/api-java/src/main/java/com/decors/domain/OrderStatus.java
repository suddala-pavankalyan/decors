package com.decors.domain;

/** PENDING (awaiting payment) → PAID → PACKED → SHIPPED → DELIVERED; CANCELLED can replace any step before SHIPPED. */
public enum OrderStatus { PENDING, PAID, PACKED, SHIPPED, DELIVERED, CANCELLED }
