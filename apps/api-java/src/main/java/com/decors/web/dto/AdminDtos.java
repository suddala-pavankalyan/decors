package com.decors.web.dto;

import com.decors.common.Trim;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class AdminDtos {
  private AdminDtos() {}

  /** Trims and lower-cases each tag, drops blanks and duplicates. Anything but an array of strings is rejected. */
  public static class CleanTags extends JsonDeserializer<List<String>> {
    @Override
    public List<String> deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
      if (p.currentToken() != JsonToken.START_ARRAY) {
        @SuppressWarnings("unchecked")
        List<String> r = (List<String>) ctxt.handleUnexpectedToken(List.class, p);
        return r;
      }
      Set<String> out = new LinkedHashSet<>();
      while (p.nextToken() != JsonToken.END_ARRAY) {
        if (p.currentToken() != JsonToken.VALUE_STRING) {
          ctxt.handleUnexpectedToken(String.class, p);
        }
        String t = p.getText().trim().toLowerCase();
        if (!t.isEmpty()) out.add(t);
      }
      return new ArrayList<>(out);
    }
  }

  public record ProductInput(
      @JsonDeserialize(using = Trim.class) @NotNull(message = "name must be a string")
      @Size(min = 1, max = 120, message = "name must be longer than or equal to 1 and shorter than or equal to 120 characters")
      String name,
      @NotNull(message = "category must be one of the following values: wedding-cards, gift-cards, wall-decor, paints")
      String category,
      @NotNull(message = "price must be an integer number")
      @Min(value = 1, message = "price must not be less than 1")
      @Max(value = 1_000_000, message = "price must not be greater than 1000000")
      Integer price,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "description must be a string")
      @Size(min = 1, max = 2000, message = "description must be longer than or equal to 1 and shorter than or equal to 2000 characters")
      String description,
      @NotNull(message = "rating must be a number conforming to the specified constraints")
      @Min(value = 0, message = "rating must not be less than 0")
      @Max(value = 5, message = "rating must not be greater than 5")
      Double rating,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "colorName must be a string")
      @Size(min = 1, max = 40, message = "colorName must be longer than or equal to 1 and shorter than or equal to 40 characters")
      String colorName,
      @NotNull(message = "colorHex must look like #RRGGBB")
      @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "colorHex must look like #RRGGBB")
      String colorHex,
      @JsonDeserialize(using = CleanTags.class) @NotNull(message = "tags must be an array")
      @Size(max = 10, message = "tags must contain no more than 10 elements")
      List<@Size(min = 1, max = 30, message = "each value in tags must be longer than or equal to 1 and shorter than or equal to 30 characters") String> tags) {

    @AssertTrue(message = "rating must be a number conforming to the specified constraints")
    boolean isRatingOneDecimal() {
      return rating == null || Math.abs(rating * 10 - Math.rint(rating * 10)) < 1e-9;
    }
  }

  public record Reorder(
      @NotNull(message = "ids must be an array")
      @Size(max = 20, message = "ids must contain no more than 20 elements")
      List<@NotNull(message = "each value in ids must be an integer number") Integer> ids) {}

  public record OrderStep(
      @NotNull(message = "status must be a string") String status,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 60, message = "carrier must be shorter than or equal to 60 characters")
      String carrier,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 80, message = "trackingNumber must be shorter than or equal to 80 characters")
      String trackingNumber) {}

  /** Dates are ISO-8601 (such as 2026-12-31T18:29:59.000Z); leave a field out or null for "no limit". */
  public record CouponInput(
      @JsonDeserialize(using = Trim.Upper.class) @NotNull(message = "code must be a string")
      @Pattern(regexp = "^[A-Z0-9_-]{3,20}$", message = "code must be 3-20 letters, numbers, dashes or underscores")
      String code,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 120, message = "description must be shorter than or equal to 120 characters")
      String description,
      @NotNull(message = "type must be PERCENT or FLAT") @Pattern(regexp = "^(PERCENT|FLAT)$", message = "type must be PERCENT or FLAT")
      String type,
      @NotNull(message = "value must be an integer number") @Min(value = 1, message = "value must not be less than 1")
      @Max(value = 100_000_000, message = "value must not be greater than 100000000")
      Integer value,
      @Min(value = 1, message = "maxDiscountPaise must not be less than 1") Integer maxDiscountPaise,
      @Min(value = 0, message = "minOrderPaise must not be less than 0") Integer minOrderPaise,
      java.time.Instant startsAt,
      java.time.Instant expiresAt,
      @Min(value = 1, message = "usageLimit must not be less than 1") Integer usageLimit,
      @Min(value = 1, message = "perUserLimit must not be less than 1") Integer perUserLimit,
      Boolean active) {}
}
