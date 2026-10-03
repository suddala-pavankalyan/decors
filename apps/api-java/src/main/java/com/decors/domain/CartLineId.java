package com.decors.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;

/** A cart line: one product in one option ({@code variantId} is "" for products without options). */
@Embeddable
public record CartLineId(String userId, String productId, String variantId) implements Serializable {}
