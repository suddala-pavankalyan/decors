package com.decors.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;

@Embeddable
public record CartItemId(String userId, String productId) implements Serializable {}
