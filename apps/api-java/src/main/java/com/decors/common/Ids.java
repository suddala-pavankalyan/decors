package com.decors.common;

import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicInteger;

/** Short, unique, URL-safe ids in the same style as the ones the NestJS API (Prisma cuid) creates. */
public final class Ids {
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final AtomicInteger COUNTER = new AtomicInteger(RANDOM.nextInt(1_000_000));

  private Ids() {}

  public static String newId() {
    String time = Long.toString(System.currentTimeMillis(), 36);
    String count = pad(Integer.toString(COUNTER.getAndIncrement() & 0xFFFFF, 36), 4);
    StringBuilder rnd = new StringBuilder();
    for (int i = 0; i < 8; i++) rnd.append(Character.forDigit(RANDOM.nextInt(36), 36));
    return "c" + time + count + rnd;
  }

  private static String pad(String s, int n) {
    return s.length() >= n ? s.substring(s.length() - n) : "0".repeat(n - s.length()) + s;
  }
}
