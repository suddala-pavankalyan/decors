package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A one-time emailed link. Only a SHA-256 hash of the token is stored. */
@Entity
@Table(name = "AuthToken")
public class AuthToken {
  @Id
  public String id;
  public String userId;
  @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  public AuthTokenType type;
  public String tokenHash;
  public LocalDateTime expiresAt;
  public LocalDateTime usedAt;
  public LocalDateTime createdAt;
}
