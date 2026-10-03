package com.decors.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@EnableJpaRepositories(basePackages = "com.decors.repo", considerNestedRepositories = true)
public class JpaConfig {}
