package com.decors.web.dto;

import com.decors.common.Trim;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PaymentDtos {
  private PaymentDtos() {}

  public record Address(
      @JsonDeserialize(using = Trim.class) @NotNull(message = "name must be a string")
      @Size(min = 1, max = 80, message = "name must be longer than or equal to 1 and shorter than or equal to 80 characters")
      String name,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "phone must be a 10-digit Indian mobile number")
      @Pattern(regexp = "^[6-9]\\d{9}$", message = "phone must be a 10-digit Indian mobile number")
      String phone,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "line1 must be a string")
      @Size(min = 1, max = 120, message = "line1 must be longer than or equal to 1 and shorter than or equal to 120 characters")
      String line1,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 120, message = "line2 must be shorter than or equal to 120 characters")
      String line2,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "city must be a string")
      @Size(min = 1, max = 60, message = "city must be longer than or equal to 1 and shorter than or equal to 60 characters")
      String city,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "state must be a string")
      @Size(min = 1, max = 60, message = "state must be longer than or equal to 1 and shorter than or equal to 60 characters")
      String state,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "pincode must be 6 digits")
      @Pattern(regexp = "^[1-9]\\d{5}$", message = "pincode must be 6 digits")
      String pincode,
      /** Checkout only: also keep this address in the customer's address book. */
      Boolean saveAddress) {}

  /** A saved address: the same fields, plus whether it is the default. */
  public record SavedAddress(
      @JsonDeserialize(using = Trim.class) @NotNull(message = "name must be a string")
      @Size(min = 1, max = 80, message = "name must be longer than or equal to 1 and shorter than or equal to 80 characters")
      String name,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "phone must be a 10-digit Indian mobile number")
      @Pattern(regexp = "^[6-9]\\d{9}$", message = "phone must be a 10-digit Indian mobile number")
      String phone,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "line1 must be a string")
      @Size(min = 1, max = 120, message = "line1 must be longer than or equal to 1 and shorter than or equal to 120 characters")
      String line1,
      @JsonDeserialize(using = Trim.class)
      @Size(max = 120, message = "line2 must be shorter than or equal to 120 characters")
      String line2,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "city must be a string")
      @Size(min = 1, max = 60, message = "city must be longer than or equal to 1 and shorter than or equal to 60 characters")
      String city,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "state must be a string")
      @Size(min = 1, max = 60, message = "state must be longer than or equal to 1 and shorter than or equal to 60 characters")
      String state,
      @JsonDeserialize(using = Trim.class) @NotNull(message = "pincode must be 6 digits")
      @Pattern(regexp = "^[1-9]\\d{5}$", message = "pincode must be 6 digits")
      String pincode,
      Boolean isDefault) {}

  public record Verify(
      @NotNull(message = "orderId must be a string") String orderId,
      @NotNull(message = "razorpay_order_id must be a string") String razorpay_order_id,
      @NotNull(message = "razorpay_payment_id must be a string") String razorpay_payment_id,
      @NotNull(message = "razorpay_signature must be a string") String razorpay_signature) {}

  public record Cancel(
      @JsonDeserialize(using = Trim.class)
      @Size(max = 200, message = "reason must be shorter than or equal to 200 characters")
      String reason) {}
}
