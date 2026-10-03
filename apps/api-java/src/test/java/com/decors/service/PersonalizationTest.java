package com.decors.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decors.common.ApiException;
import com.decors.web.dto.AccountDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PersonalizationTest {
  private final PersonalizationService service = new PersonalizationService(new ObjectMapper());
  private static final LocalDate TODAY = LocalDate.of(2026, 10, 3);

  private static AccountDtos.Personalization details(String date) {
    return new AccountDtos.Personalization("Asha", "Rohan", date, "Taj Hotel, Bengaluru", "With love");
  }

  @Test
  void acceptsTodayAndTheNextThreeYears() {
    assertTrue(service.validate(details("2026-10-03"), TODAY).contains("\"eventDate\":\"2026-10-03\""));
    service.validate(details("2029-10-03"), TODAY);
  }

  @Test
  void rejectsPastAndFarFutureDates() {
    assertEquals("The event date cannot be in the past", assertThrows(ApiException.class, () -> service.validate(details("2026-10-02"), TODAY)).getMessage());
    assertTrue(assertThrows(ApiException.class, () -> service.validate(details("2029-10-04"), TODAY)).getMessage().contains("within the next 3 years"));
    assertTrue(assertThrows(ApiException.class, () -> service.validate(details("2026-02-30"), TODAY)).getMessage().contains("must be a date"));
  }

  @Test
  void rejectsControlCharacters() {
    var bad = new AccountDtos.Personalization("Asha", "Ro\u0007han", "2027-01-01", "Hall", null);
    assertEquals("partnerTwo must be plain text", assertThrows(ApiException.class, () -> service.validate(bad, TODAY)).getMessage());
  }

  @Test
  void emptyNoteIsStoredAsNull() {
    var d = new AccountDtos.Personalization("A", "B", "2027-01-01", "Hall", "   ");
    assertTrue(service.validate(d, TODAY).contains("\"note\":null"));
  }

  @Test
  void checkoutNeedsDetailsThatAreStillValid() {
    assertTrue(assertThrows(ApiException.class, () -> service.requireUsable("Card", null, TODAY)).getMessage().contains("Add the card details for Card"));
    String old = "{\"eventDate\":\"2026-01-01\"}";
    assertTrue(assertThrows(ApiException.class, () -> service.requireUsable("Card", old, TODAY)).getMessage().contains("need updating"));
    service.requireUsable("Card", "{\"eventDate\":\"2027-01-01\"}", TODAY);
  }
}
