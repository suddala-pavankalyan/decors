package com.decors.common;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Runs work after the response has gone out (sending email), logging failures instead of losing them. */
@Component
public class Background {
  private static final Logger log = LoggerFactory.getLogger(Background.class);
  private final ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor();

  public void run(String what, Runnable task) {
    pool.execute(() -> {
      try {
        task.run();
      } catch (Exception e) {
        log.error("{} failed: {}", what, e.getMessage());
      }
    });
  }
}
