package com.decors.web.dto;

import com.decors.common.Trim;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ReviewDtos {
  private ReviewDtos() {}

  public record ReviewInput(
      @NotNull(message = "rating must be an integer number") @Min(value = 1, message = "rating must not be less than 1")
      @Max(value = 5, message = "rating must not be greater than 5") Integer rating,
      @JsonDeserialize(using = Trim.class) @Size(max = 80, message = "title must be shorter than or equal to 80 characters") String title,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "body must be a string")
      @Size(min = 10, max = 2000, message = "body must be longer than or equal to 10 and shorter than or equal to 2000 characters") String body) {}
}
