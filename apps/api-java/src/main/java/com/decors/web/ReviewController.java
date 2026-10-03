package com.decors.web;

import com.decors.common.ApiException;
import com.decors.domain.AppUser;
import com.decors.security.Authenticated;
import com.decors.security.CurrentUser;
import com.decors.security.RateLimit;
import com.decors.service.ReviewService;
import com.decors.web.dto.ReviewDtos;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/products/{productId}/reviews")
public class ReviewController {
  private final ReviewService reviews;

  public ReviewController(ReviewService reviews) {
    this.reviews = reviews;
  }

  /** Published reviews with the rating summary. Public. */
  @GetMapping
  public ReviewService.ReviewPage list(@PathVariable String productId, @RequestParam(required = false) String sort,
      @RequestParam(required = false) Integer limit, @RequestParam(required = false) Integer offset) {
    if (sort != null && !sort.isEmpty() && !sort.equals("newest") && !sort.equals("highest") && !sort.equals("lowest")) throw ApiException.badRequest("sort must be newest, highest or lowest");
    if (limit != null && (limit < 1 || limit > 50)) throw ApiException.badRequest(limit < 1 ? "limit must not be less than 1" : "limit must not be greater than 50");
    if (offset != null && (offset < 0 || offset > 100000)) throw ApiException.badRequest(offset < 0 ? "offset must not be less than 0" : "offset must not be greater than 100000");
    return reviews.list(productId, sort, limit == null ? 10 : limit, offset == null ? 0 : offset);
  }

  /** The caller's own review of this product (if any) and whether they may write one. */
  @GetMapping("/mine") @Authenticated
  public ReviewService.Mine mine(@CurrentUser AppUser user, @PathVariable String productId) {
    return reviews.mine(user, productId);
  }

  @PutMapping("/mine") @Authenticated @RateLimit(limit = 20)
  public ReviewService.Mine save(@CurrentUser AppUser user, @PathVariable String productId, @Valid @RequestBody ReviewDtos.ReviewInput dto) {
    return reviews.save(user, productId, dto.rating(), dto.title(), dto.body());
  }

  @DeleteMapping("/mine") @Authenticated @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@CurrentUser AppUser user, @PathVariable String productId) {
    reviews.delete(user, productId);
  }

  @PostMapping("/mine/images") @Authenticated @RateLimit(limit = 30) @ResponseStatus(HttpStatus.CREATED)
  public ReviewService.Mine addPhoto(@CurrentUser AppUser user, @PathVariable String productId, @RequestPart(value = "file", required = false) MultipartFile file) throws IOException {
    return reviews.addPhoto(user, productId, file == null ? null : file.getBytes());
  }

  @DeleteMapping("/mine/images/{imageId}") @Authenticated
  public ReviewService.Mine removePhoto(@CurrentUser AppUser user, @PathVariable String productId, @PathVariable int imageId) {
    return reviews.removePhoto(user, productId, imageId);
  }
}
