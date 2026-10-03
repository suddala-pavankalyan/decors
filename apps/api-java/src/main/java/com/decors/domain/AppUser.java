package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** The "User" table ("User" is a reserved word, hence the different class name). */
@Entity(name = "AppUser")
@Table(name = "User")
public class AppUser {
  @Id
  public String id;
  public String email;
  public String name;
  public String passwordHash;
  @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  public Role role = Role.USER;
  /** Bumped on password change; login tokens issued before that stop working. */
  public int tokenVersion;
  public LocalDateTime emailVerifiedAt;
  public LocalDateTime createdAt;
}
