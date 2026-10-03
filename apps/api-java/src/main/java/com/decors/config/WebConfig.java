package com.decors.config;

import com.decors.security.AuthInterceptor;
import com.decors.security.CurrentUserResolver;
import com.decors.security.RateLimitInterceptor;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  private final AppProperties props;
  private final RateLimitInterceptor rateLimit;
  private final AuthInterceptor auth;
  private final CurrentUserResolver currentUser;

  public WebConfig(AppProperties props, RateLimitInterceptor rateLimit, AuthInterceptor auth, CurrentUserResolver currentUser) {
    this.props = props;
    this.rateLimit = rateLimit;
    this.auth = auth;
    this.currentUser = currentUser;
  }

  /** Where uploaded photos live (created on first use). */
  public Path uploadDir() {
    return Path.of(props.uploadDir()).toAbsolutePath().normalize();
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    // Rate limiting first, then login checks (same order as the NestJS API: throttle guard, then auth guard).
    registry.addInterceptor(rateLimit).addPathPatterns("/**").excludePathPatterns("/uploads/**");
    registry.addInterceptor(auth).addPathPatterns("/**").excludePathPatterns("/uploads/**");
  }

  @Override
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
    resolvers.add(currentUser);
  }

  /** The website runs on another origin and needs cookies, so credentials are allowed for that one origin only. */
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/**")
        .allowedOrigins(props.webOrigin())
        .allowedMethods("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders("Content-Disposition") // so the website can name downloads (invoices)
        .allowCredentials(true)
        .maxAge(3600);
  }

  /** Uploaded product photos. Names are random UUIDs, so browsers may cache them for a long time. */
  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    try {
      Files.createDirectories(uploadDir());
    } catch (IOException e) {
      throw new IllegalStateException("Cannot create the upload directory " + uploadDir(), e);
    }
    registry.addResourceHandler("/uploads/**")
        .addResourceLocations(uploadDir().toUri().toString())
        .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic().immutable());
  }

  /** Safe-serving headers for photos: never let a browser guess a different type, and allow the website to show them. */
  @Bean
  FilterRegistrationBean<OncePerRequestFilter> uploadHeaders() {
    FilterRegistrationBean<OncePerRequestFilter> bean = new FilterRegistrationBean<>(new OncePerRequestFilter() {
      @Override
      protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
          throws ServletException, IOException {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        chain.doFilter(req, res);
      }
    });
    bean.addUrlPatterns("/uploads/*");
    return bean;
  }
}
