package com.decors.security;

import com.decors.common.ApiException;
import com.decors.domain.AppUser;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@Component
public class CurrentUserResolver implements HandlerMethodArgumentResolver {
  @Override
  public boolean supportsParameter(MethodParameter p) {
    return p.hasParameterAnnotation(CurrentUser.class) && AppUser.class.isAssignableFrom(p.getParameterType());
  }

  @Override
  public Object resolveArgument(MethodParameter p, ModelAndViewContainer m, NativeWebRequest req, WebDataBinderFactory f) {
    Object user = req.getAttribute(CurrentUser.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
    if (user == null) throw ApiException.unauthorized();
    return user;
  }
}
