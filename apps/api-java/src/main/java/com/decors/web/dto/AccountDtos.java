package com.decors.web.dto;

import com.decors.common.Trim;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AccountDtos {
  private AccountDtos() {}

  public static final int MAX_QTY = 99;

  /** What a customer puts on a personalised card (names, date, venue, an optional note). */
  public record Personalization(
      @JsonDeserialize(using = Trim.class) @NotNull(message = "partnerOne must be a string")
      @Size(min = 1, max = 40, message = "partnerOne must be longer than or equal to 1 and shorter than or equal to 40 characters")
      String partnerOne,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "partnerTwo must be a string")
      @Size(min = 1, max = 40, message = "partnerTwo must be longer than or equal to 1 and shorter than or equal to 40 characters")
      String partnerTwo,
      @NotNull(message = "eventDate must be a date like 2026-12-05")
      @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "eventDate must be a date like 2026-12-05")
      String eventDate,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "venue must be a string")
      @Size(min = 1, max = 120, message = "venue must be longer than or equal to 1 and shorter than or equal to 120 characters")
      String venue,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 200, message = "note must be shorter than or equal to 200 characters")
      String note) {}

  public record SetQty(
      @NotNull(message = "qty must be an integer number")
      @Min(value = 0, message = "qty must not be less than 0")
      @Max(value = MAX_QTY, message = "qty must not be greater than 99")
      Integer qty,
      /** Optional: leave it out to keep the details already saved on the line. */
      @Valid Personalization personalization) {}

  public record CartLine(
      @NotNull(message = "productId must be a string") String productId,
      @NotNull(message = "qty must be an integer number")
      @Min(value = 1, message = "qty must not be less than 1")
      @Max(value = MAX_QTY, message = "qty must not be greater than 99")
      Integer qty,
      @Valid Personalization personalization) {}

  public record Merge(
      @NotNull(message = "cart must be an array")
      @Size(max = 200, message = "cart must contain no more than 200 elements")
      List<@Valid @NotNull(message = "cart must be an array") CartLine> cart,
      @NotNull(message = "wishlist must be an array")
      @Size(max = 200, message = "wishlist must contain no more than 200 elements")
      List<@NotNull(message = "each value in wishlist must be a string") String> wishlist) {}
}
