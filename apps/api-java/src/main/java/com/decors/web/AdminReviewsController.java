package com.decors.web;

import com.decors.common.ApiException;
import com.decors.security.AdminOnly;
import com.decors.service.ReviewService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/reviews")
@AdminOnly
public class AdminReviewsController {
  private final ReviewService reviews;

  public AdminReviewsController(ReviewService reviews) {
    this.reviews = reviews;
  }

  @GetMapping
  public ReviewService.AdminPage list(@RequestParam(required = false) String status, @RequestParam(required = false) Integer rating, @RequestParam(required = false) String q,
      @RequestParam(required = false) Integer limit, @RequestParam(required = false) Integer offset) {
    if (rating != null && (rating < 1 || rating > 5)) throw ApiException.badRequest("rating must be between 1 and 5");
    if (q != null && q.trim().length() > 100) throw ApiException.badRequest("q must be shorter than or equal to 100 characters");
    if (limit != null && (limit < 1 || limit > 100)) throw ApiException.badRequest(limit < 1 ? "limit must not be less than 1" : "limit must not be greater than 100");
    if (offset != null && (offset < 0 || offset > 100000)) throw ApiException.badRequest(offset < 0 ? "offset must not be less than 0" : "offset must not be greater than 100000");
    return reviews.adminList(status, rating, q, limit == null ? 30 : limit, offset == null ? 0 : offset);
  }

  /** Hide or show a review, and/or reply to it. Fields left out are unchanged; an empty reply removes it. */
  @PutMapping("/{id}")
  public ReviewService.AdminRow update(@PathVariable String id, @RequestBody java.util.Map<String, Object> body) {
    Object status = body.get("status");
    if (status != null && !(status instanceof String)) throw ApiException.badRequest("status must be PUBLISHED or HIDDEN");
    boolean replyGiven = body.containsKey("reply");
    Object reply = body.get("reply");
    if (reply != null && !(reply instanceof String)) throw ApiException.badRequest("reply must be a string");
    if (reply != null && ((String) reply).trim().length() > 500) throw ApiException.badRequest("reply must be shorter than or equal to 500 characters");
    if (status == null && !replyGiven) throw ApiException.badRequest("Send a status and/or a reply");
    return reviews.adminUpdate(id, (String) status, (String) reply, replyGiven);
  }

  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable String id) {
    reviews.adminDelete(id);
  }
}
