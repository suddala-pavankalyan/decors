package com.decors.common;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;

/** Timestamps are stored as UTC (the database columns have no time zone) and sent to clients as ISO-8601 with a Z. */
public final class Time {
  public static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  private Time() {}

  public static LocalDateTime now() {
    return LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  public static LocalDateTime nowPlus(long millis) {
    return now().plusNanos(millis * 1_000_000);
  }

  public static boolean isPast(LocalDateTime t) {
    return t.isBefore(now());
  }
}
