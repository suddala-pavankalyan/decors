package com.decors.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Background jobs run only in the web server, not in one-off commands such as seed. */
@Configuration
@EnableScheduling
@Profile("!cli")
public class SchedulingConfig {}
