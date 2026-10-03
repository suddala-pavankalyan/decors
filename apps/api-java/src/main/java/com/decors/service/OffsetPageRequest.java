package com.decors.service;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/** "Skip N, take M": unlike {@code PageRequest}, the offset does not have to be a multiple of the page size. */
public class OffsetPageRequest implements Pageable {
  private final long offset;
  private final int limit;
  private final Sort sort;

  public OffsetPageRequest(long offset, int limit, Sort sort) {
    this.offset = offset;
    this.limit = limit;
    this.sort = sort;
  }

  @Override public int getPageNumber() { return (int) (offset / limit); }
  @Override public int getPageSize() { return limit; }
  @Override public long getOffset() { return offset; }
  @Override public Sort getSort() { return sort; }
  @Override public Pageable next() { return new OffsetPageRequest(offset + limit, limit, sort); }
  @Override public Pageable previousOrFirst() { return new OffsetPageRequest(Math.max(0, offset - limit), limit, sort); }
  @Override public Pageable first() { return new OffsetPageRequest(0, limit, sort); }
  @Override public Pageable withPage(int pageNumber) { return new OffsetPageRequest((long) pageNumber * limit, limit, sort); }
  @Override public boolean hasPrevious() { return offset > 0; }
}
