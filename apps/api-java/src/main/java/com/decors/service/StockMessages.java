package com.decors.service;

/** What customers are told when there is not enough stock. */
public final class StockMessages {
  private StockMessages() {}

  public static String shortage(String name, int available) {
    return available <= 0 ? "Sorry, " + name + " is sold out" : "Only " + available + " of " + name + " " + (available == 1 ? "is" : "are") + " available";
  }
}
