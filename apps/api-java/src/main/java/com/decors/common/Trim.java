package com.decors.common;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import java.io.IOException;

/** JSON string, with leading/trailing spaces removed (anything that is not a JSON string is rejected). */
public class Trim extends StdDeserializer<String> {
  public Trim() {
    super(String.class);
  }

  @Override
  public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
    if (p.currentToken() != JsonToken.VALUE_STRING) {
      return (String) ctxt.handleUnexpectedToken(String.class, p);
    }
    return normalize(p.getText());
  }

  protected String normalize(String s) {
    return s.trim();
  }

  /** Same, and upper-cased: for coupon codes. */
  public static class Upper extends Trim {
    @Override
    protected String normalize(String s) {
      return s.trim().toUpperCase();
    }
  }

  /** Same, and lower-cased: for email addresses. */
  public static class Lower extends Trim {
    @Override
    protected String normalize(String s) {
      return s.trim().toLowerCase();
    }
  }
}
