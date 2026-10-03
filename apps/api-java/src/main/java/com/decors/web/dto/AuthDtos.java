package com.decors.web.dto;

import com.decors.common.Trim;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies for /auth. Messages follow the wording the NestJS API gave, so clients see the same text. */
public final class AuthDtos {
  private AuthDtos() {}

  public record Register(
      @JsonDeserialize(using = Trim.class)
      @NotNull(message = "name must be a string")
      @Size(min = 1, message = "name must be longer than or equal to 1 characters")
      @Size(max = 80, message = "name must be shorter than or equal to 80 characters")
      String name,
      @JsonDeserialize(using = Trim.Lower.class)
      @NotNull(message = "email must be an email")
      @Email(message = "email must be an email")
      @Size(max = 254, message = "email must be shorter than or equal to 254 characters")
      String email,
      @NotNull(message = "password must be a string")
      @Size(min = 8, message = "password must be longer than or equal to 8 characters")
      @Size(max = 72, message = "password must be shorter than or equal to 72 characters")
      String password) {}

  public record Login(
      @JsonDeserialize(using = Trim.Lower.class)
      @NotNull(message = "email must be an email")
      @Email(message = "email must be an email")
      String email,
      @NotNull(message = "password must be a string")
      @Size(max = 72, message = "password must be shorter than or equal to 72 characters")
      String password) {}

  public record UpdateProfile(
      @JsonDeserialize(using = Trim.class)
      @NotNull(message = "name must be a string")
      @Size(min = 1, message = "name must be longer than or equal to 1 characters")
      @Size(max = 80, message = "name must be shorter than or equal to 80 characters")
      String name) {}

  public record ChangePassword(
      @NotNull(message = "currentPassword must be a string")
      @Size(max = 72, message = "currentPassword must be shorter than or equal to 72 characters")
      String currentPassword,
      @NotNull(message = "newPassword must be a string")
      @Size(min = 8, message = "newPassword must be longer than or equal to 8 characters")
      @Size(max = 72, message = "newPassword must be shorter than or equal to 72 characters")
      String newPassword) {}

  public record Forgot(
      @JsonDeserialize(using = Trim.Lower.class)
      @NotNull(message = "email must be an email")
      @Email(message = "email must be an email")
      @Size(max = 254, message = "email must be shorter than or equal to 254 characters")
      String email) {}

  public record Reset(
      @NotNull(message = "token must be a string")
      @Size(min = 20, max = 200, message = "token must be longer than or equal to 20 characters")
      String token,
      @NotNull(message = "newPassword must be a string")
      @Size(min = 8, message = "newPassword must be longer than or equal to 8 characters")
      @Size(max = 72, message = "newPassword must be shorter than or equal to 72 characters")
      String newPassword) {}

  public record Verify(
      @NotNull(message = "token must be a string")
      @Size(min = 20, max = 200, message = "token must be longer than or equal to 20 characters")
      String token) {}
}
