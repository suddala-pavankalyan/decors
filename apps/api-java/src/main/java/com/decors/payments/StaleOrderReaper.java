package com.decors.payments;

import com.decors.common.Time;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Orders that were started but never paid hold their stock (and coupon) for a while, then let go: this cancels them so
 * the units go back on sale. A payment that still arrives afterwards is refunded automatically.
 */
@Component
@Profile("!cli")
public class StaleOrderReaper {
  /** How long an unpaid order keeps its stock. */
  public static final long HOLD_MINUTES = 30;
  private static final Logger log = LoggerFactory.getLogger(StaleOrderReaper.class);

  private final JdbcClient jdbc;
  private final CancellationService cancellation;

  public StaleOrderReaper(JdbcClient jdbc, CancellationService cancellation) {
    this.jdbc = jdbc;
    this.cancellation = cancellation;
  }

  @Scheduled(fixedDelayString = "${decors.orders.reap-interval-ms:300000}", initialDelayString = "${decors.orders.reap-initial-delay-ms:60000}")
  public void run() {
    try {
      reap();
    } catch (RuntimeException e) {
      log.error("Cleaning up unpaid orders failed: {}", e.getMessage());
    }
  }

  /** Returns how many orders were cancelled. */
  public int reap() {
    List<String> stale = jdbc.sql("select id from \"Order\" where status = 'PENDING' and \"createdAt\" < :cutoff order by \"createdAt\" limit 200")
        .param("cutoff", Time.now().minusMinutes(HOLD_MINUTES)).query(String.class).list();
    int n = 0;
    for (String id : stale) {
      try {
        cancellation.cancel(id, "the system", "Payment was not completed in time", false);
        n++;
      } catch (RuntimeException e) {
        // Paid or cancelled by someone else a moment ago: nothing to do.
        log.debug("Skipping order {}: {}", id, e.getMessage());
      }
    }
    if (n > 0) log.info("Cancelled {} unpaid orders and released their stock", n);
    return n;
  }
}
