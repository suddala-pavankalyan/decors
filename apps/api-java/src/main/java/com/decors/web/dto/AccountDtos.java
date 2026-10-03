package com.decors.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AccountDtos {
  private AccountDtos() {}

  public static final int MAX_QTY = 99;

  public record SetQty(
      @NotNull(message = "qty must be an integer number")
      @Min(value = 0, message = "qty must not be less than 0")
      @Max(value = MAX_QTY, message = "qty must not be greater than 99")
      Integer qty) {}

  public record CartLine(
      @NotNull(message = "productId must be a string") String productId,
      @NotNull(message = "qty must be an integer number")
      @Min(value = 1, message = "qty must not be less than 1")
      @Max(value = MAX_QTY, message = "qty must not be greater than 99")
      Integer qty) {}

  public record Merge(
      @NotNull(message = "cart must be an array")
      @Size(max = 200, message = "cart must contain no more than 200 elements")
      List<@Valid @NotNull(message = "cart must be an array") CartLine> cart,
      @NotNull(message = "wishlist must be an array")
      @Size(max = 200, message = "wishlist must contain no more than 200 elements")
      List<@NotNull(message = "each value in wishlist must be a string") String> wishlist) {}
}
