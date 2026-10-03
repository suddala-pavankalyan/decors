package com.decors;

import java.util.Set;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class DecorsApplication {

  /** Commands that run once and exit instead of starting the web server. */
  private static final Set<String> COMMANDS = Set.of("seed", "make-admin");

  public static void main(String[] args) {
    // Everything is stored and shown in UTC. Pinning the JVM to it also avoids a startup failure on machines whose
    // zone has a legacy name (Windows in India reports "Asia/Calcutta", which newer Postgres refuses).
    java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
    if (args.length > 0 && COMMANDS.contains(args[0])) {
      var ctx = new SpringApplicationBuilder(DecorsApplication.class)
          .web(WebApplicationType.NONE)
          .profiles("cli")
          .logStartupInfo(false)
          .run(args);
      ctx.close();
      System.exit(com.decors.cli.Cli.exitCode);
      return;
    }
    SpringApplication.run(DecorsApplication.class, args);
  }
}
