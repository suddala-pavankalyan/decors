package com.decors.web;

import com.decors.domain.AppUser;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.service.AccountService;
import com.decors.service.AddressService;
import com.decors.web.dto.PaymentDtos;
import java.util.List;
import com.decors.web.dto.AccountDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/account")
@Authenticated
public class AccountController {
  private final AccountService account;
  private final AddressService addresses;

  public AccountController(AccountService account, AddressService addresses) {
    this.account = account;
    this.addresses = addresses;
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
    account.setQty(user.id, productId, dto.qty(), dto.personalization());
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

  @GetMapping("/addresses")
  public List<AddressService.AddressView> addresses(@CurrentUser AppUser user) {
    return addresses.list(user.id);
  }

  @PostMapping("/addresses") @ResponseStatus(HttpStatus.CREATED)
  public AddressService.AddressView addAddress(@CurrentUser AppUser user, @Valid @RequestBody PaymentDtos.SavedAddress dto) {
    return addresses.create(user.id, dto);
  }

  @PutMapping("/addresses/{id}")
  public AddressService.AddressView updateAddress(@CurrentUser AppUser user, @PathVariable String id,
      @Valid @RequestBody PaymentDtos.SavedAddress dto) {
    return addresses.update(user.id, id, dto);
  }

  @PostMapping("/addresses/{id}/default")
  public List<AddressService.AddressView> defaultAddress(@CurrentUser AppUser user, @PathVariable String id) {
    return addresses.setDefault(user.id, id);
  }

  @DeleteMapping("/addresses/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteAddress(@CurrentUser AppUser user, @PathVariable String id) {
    addresses.delete(user.id, id);
  }
}
