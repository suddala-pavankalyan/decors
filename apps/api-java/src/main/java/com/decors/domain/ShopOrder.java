package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** The "Order" table ("Order" is reserved in queries, hence the class name). Amounts are in paise. */
@Entity(name = "ShopOrder")
@Table(name = "Order")
public class ShopOrder {
  @Id
  public String id;
  public String userId;
  @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  public OrderStatus status = OrderStatus.PENDING;
  public int amount;
  public int subtotalPaise;
  public int discountPaise;
  public int shippingPaise;
  public java.time.LocalDate estimatedFrom;
  public java.time.LocalDate estimatedTo;
  public String couponId;
  public String couponCode;
  public String currency = "INR";
  public String razorpayOrderId;
  public String razorpayPaymentId;
  public String shipName;
  public String shipPhone;
  public String shipLine1;
  public String shipLine2;
  public String shipCity;
  public String shipState;
  public String shipPincode;
  public LocalDateTime createdAt;
  public LocalDateTime paidAt;
  public String carrier;
  public String trackingNumber;
  public String cancelReason;
  /** null, PENDING, PROCESSING, PROCESSED or FAILED. */
  public String refundStatus;
  public String refundId;
  public LocalDateTime refundedAt;
}
