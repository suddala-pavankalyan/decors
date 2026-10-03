package com.decors.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  /** For load balancers and "is it up?" checks. */
  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok");
  }
}
