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
      @NotNull(message = "stock must be an integer number") @Min(value = 0, message = "stock must not be less than 0")
      @Max(value = 1_000_000, message = "stock must not be greater than 1000000")
      Integer stock,
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
      @NotNull(message = "type must be PERCENT, FLAT or FREE_SHIPPING")
      @Pattern(regexp = "^(PERCENT|FLAT|FREE_SHIPPING)$", message = "type must be PERCENT, FLAT or FREE_SHIPPING")
      String type,
      /** Percent, or paise for FLAT. Ignored (may be left out) for FREE_SHIPPING. */
      @Min(value = 0, message = "value must not be less than 0")
      @Max(value = 100_000_000, message = "value must not be greater than 100000000")
      Integer value,
      @Min(value = 1, message = "maxDiscountPaise must not be less than 1") Integer maxDiscountPaise,
      @Min(value = 0, message = "minOrderPaise must not be less than 0") Integer minOrderPaise,
      java.time.Instant startsAt,
      java.time.Instant expiresAt,
      @Min(value = 1, message = "usageLimit must not be less than 1") Integer usageLimit,
      @Min(value = 1, message = "perUserLimit must not be less than 1") Integer perUserLimit,
      Boolean active) {}

  public record ShippingInput(
      @NotNull(message = "baseFeePaise must be an integer number") @Min(value = 0, message = "baseFeePaise must not be less than 0")
      @Max(value = 1_000_000, message = "baseFeePaise must not be greater than 1000000")
      Integer baseFeePaise,
      @Min(value = 1, message = "freeAbovePaise must not be less than 1") Integer freeAbovePaise,
      @NotNull(message = "originPincode must be 6 digits") @Pattern(regexp = "^[1-9][0-9]{5}$", message = "originPincode must be 6 digits")
      String originPincode,
      @NotNull(message = "handlingDays must be an integer number") @Min(value = 0, message = "handlingDays must not be less than 0")
      @Max(value = 30, message = "handlingDays must not be greater than 30")
      Integer handlingDays,
      @NotNull(message = "blockedPrefixes must be an array") @Size(max = 50, message = "blockedPrefixes must contain no more than 50 elements")
      List<@Pattern(regexp = "^[1-9][0-9]{0,5}$", message = "each blocked prefix must be 1-6 digits") String> blockedPrefixes) {}

  public record RateInput(
      @NotNull(message = "ratePercent must be an integer number") @Min(value = 0, message = "ratePercent must not be less than 0")
      @Max(value = 28, message = "ratePercent must not be greater than 28") Integer ratePercent,
      @NotNull(message = "hsn must be 4-8 digits") @Pattern(regexp = "^[0-9]{4,8}$", message = "hsn must be 4-8 digits") String hsn) {}

  public record BusinessInput(
      @JsonDeserialize(using = Trim.class) @NotNull(message = "legalName must be a string")
      @Size(min = 1, max = 120, message = "legalName must be longer than or equal to 1 and shorter than or equal to 120 characters")
      String legalName,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "addressLines must be a string")
      @Size(min = 1, max = 400, message = "addressLines must be longer than or equal to 1 and shorter than or equal to 400 characters")
      String addressLines,
      @JsonDeserialize(using = Trim.Upper.class)
      @Pattern(regexp = "^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", message = "gstin must be a valid 15-character GSTIN")
      String gstin,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "stateName must be a string")
      @Size(min = 1, max = 40, message = "stateName must be longer than or equal to 1 and shorter than or equal to 40 characters")
      String stateName,
      @NotNull(message = "stateCode must be 2 digits") @Pattern(regexp = "^[0-9]{2}$", message = "stateCode must be 2 digits") String stateCode,
      @JsonDeserialize(using = Trim.class) @jakarta.validation.constraints.Email(message = "contactEmail must be an email")
      @Size(max = 120, message = "contactEmail must be shorter than or equal to 120 characters")
      String contactEmail,
      @JsonDeserialize(using = Trim.Upper.class) @NotNull(message = "invoicePrefix must be 1-3 letters")
      @Pattern(regexp = "^[A-Z]{1,3}$", message = "invoicePrefix must be 1-3 letters") String invoicePrefix,
      @NotNull(message = "shippingGstPercent must be an integer number") @Min(value = 0, message = "shippingGstPercent must not be less than 0")
      @Max(value = 28, message = "shippingGstPercent must not be greater than 28") Integer shippingGstPercent,
      @NotNull(message = "rates must be an object") java.util.Map<String, @jakarta.validation.Valid RateInput> rates) {}

  public record StockInput(
      @NotNull(message = "stock must be an integer number") @Min(value = 0, message = "stock must not be less than 0")
      @Max(value = 1_000_000, message = "stock must not be greater than 1000000") Integer stock) {}
}
