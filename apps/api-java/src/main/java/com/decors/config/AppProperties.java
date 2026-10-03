package com.decors.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Everything configurable, bound from application.yml (which reads the same environment variables as the NestJS API). */
@ConfigurationProperties(prefix = "decors")
public record AppProperties(
    String env,
    String jwtSecret,
    String webOrigin,
    String apiPublicUrl,
    String uploadDir,
    Mail mail,
    Razorpay razorpay) {

  public record Mail(String host, int port, String user, String password, boolean secure, String from) {}

  public record Razorpay(String keyId, String keySecret, String webhookSecret, String baseUrl) {}

  public boolean production() {
    return "production".equalsIgnoreCase(env);
  }

  /** Where links in emails point: the website, not the API. */
  public String webUrl() {
    return webOrigin.replaceAll("/+$", "");
  }
}
