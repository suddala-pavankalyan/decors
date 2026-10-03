package com.decors.web;

import com.decors.domain.AppUser;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.service.AccountService;
import com.decors.web.dto.AccountDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/account")
@Authenticated
public class AccountController {
  private final AccountService account;

  public AccountController(AccountService account) {
    this.account = account;
  }

  @GetMapping("/state")
  public AccountService.State state(@CurrentUser AppUser user) {
    return account.state(user.id);
  }

  @PostMapping("/merge")
  public AccountService.State merge(@CurrentUser AppUser user, @Valid @RequestBody AccountDtos.Merge dto) {
    return account.merge(user.id, dto);
  }

  @PutMapping("/cart/{productId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void setQty(@CurrentUser AppUser user, @PathVariable String productId, @Valid @RequestBody AccountDtos.SetQty dto) {
    account.setQty(user.id, productId, dto.qty());
  }

  @DeleteMapping("/cart") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void clearCart(@CurrentUser AppUser user) {
    account.clearCart(user.id);
  }

  @PutMapping("/wishlist/{productId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void addWish(@CurrentUser AppUser user, @PathVariable String productId) {
    account.addWish(user.id, productId);
  }

  @DeleteMapping("/wishlist/{productId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeWish(@CurrentUser AppUser user, @PathVariable String productId) {
    account.removeWish(user.id, productId);
  }
}
