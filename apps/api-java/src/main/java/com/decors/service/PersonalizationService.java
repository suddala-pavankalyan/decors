package com.decors.service;

import com.decors.common.ApiException;
import com.decors.web.dto.AccountDtos;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/** The names, date and venue a customer puts on a card: checked once here, whichever way they arrive. */
@Service
public class PersonalizationService {
  static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
  static final int MAX_YEARS_AHEAD = 3;

  private final ObjectMapper json;

  public PersonalizationService(ObjectMapper json) {
    this.json = json;
  }

  private static String plain(String field, String s) {
    if (s != null && s.codePoints().anyMatch(Character::isISOControl)) throw ApiException.badRequest(field + " must be plain text");
    return s;
  }

  /** Validates the details and returns them as JSON for storing. {@code today} makes the date rule testable. */
  public String validate(AccountDtos.Personalization in, LocalDate today) {
    plain("partnerOne", in.partnerOne());
    plain("partnerTwo", in.partnerTwo());
    plain("venue", in.venue());
    plain("note", in.note());
    LocalDate date = parseDate(in.eventDate());
    checkDate(date, today);
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("partnerOne", in.partnerOne());
    m.put("partnerTwo", in.partnerTwo());
    m.put("eventDate", date.toString());
    m.put("venue", in.venue());
    m.put("note", in.note() == null || in.note().isBlank() ? null : in.note());
    try {
      return json.writeValueAsString(m);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  public String validate(AccountDtos.Personalization in) {
    return validate(in, LocalDate.now(SHOP_ZONE));
  }

  static LocalDate parseDate(String s) {
    try {
      return LocalDate.parse(s);
    } catch (DateTimeParseException | NullPointerException e) {
      throw ApiException.badRequest("eventDate must be a date like 2026-12-05");
    }
  }

  static void checkDate(LocalDate date, LocalDate today) {
    if (date.isBefore(today)) throw ApiException.badRequest("The event date cannot be in the past");
    if (date.isAfter(today.plusYears(MAX_YEARS_AHEAD))) throw ApiException.badRequest("The event date must be within the next " + MAX_YEARS_AHEAD + " years");
  }

  /** Stored JSON back to a tree for responses; null stays null. */
  public JsonNode read(String text) {
    if (text == null) return null;
    try {
      return json.readTree(text);
    } catch (JsonProcessingException e) {
      return null;
    }
  }

  /** For checkout: the stored details must still make sense (the event date may have passed since they were typed). */
  public void requireUsable(String productName, String storedJson, LocalDate today) {
    if (storedJson == null) throw ApiException.badRequest("Add the card details for " + productName + " before checking out");
    JsonNode n = read(storedJson);
    try {
      checkDate(parseDate(n == null ? null : n.path("eventDate").asText(null)), today);
    } catch (ApiException e) {
      throw ApiException.badRequest("The card details for " + productName + " need updating: " + e.getMessage().replaceFirst("^The ", "the "));
    }
  }
}
