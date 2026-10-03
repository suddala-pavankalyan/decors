package com.decors.service;

import com.decors.common.ApiException;
import com.decors.common.Ids;
import com.decors.web.dto.PaymentDtos;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A customer's address book: up to {@value #MAX} addresses, one of them the default. */
@Service
public class AddressService {
  public static final int MAX = 10;

  public record AddressView(String id, String name, String phone, String line1, String line2, String city, String state,
      String pincode, boolean isDefault) {}

  private final JdbcClient jdbc;

  public AddressService(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public List<AddressView> list(String userId) {
    return jdbc.sql("""
            select id, name, phone, line1, line2, city, state, pincode, "isDefault" from "Address"
            where "userId" = :u order by "isDefault" desc, "createdAt" desc, id
            """)
        .param("u", userId)
        .query((rs, n) -> new AddressView(rs.getString("id"), rs.getString("name"), rs.getString("phone"), rs.getString("line1"),
            rs.getString("line2"), rs.getString("city"), rs.getString("state"), rs.getString("pincode"), rs.getBoolean("isDefault")))
        .list();
  }

  /** Serialises changes per customer, so the limit and the one-default rule hold even with two requests at once. */
  private void lock(String userId) {
    jdbc.sql("select id from \"User\" where id = :u for update").param("u", userId).query(String.class).optional();
  }

  private long count(String userId) {
    return jdbc.sql("select count(*) from \"Address\" where \"userId\" = :u").param("u", userId).query(Long.class).single();
  }

  private static String line2(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }

  private String insert(String userId, PaymentDtos.SavedAddress a, boolean makeDefault) {
    String id = Ids.newId();
    if (makeDefault) clearDefault(userId);
    jdbc.sql("""
            insert into "Address" (id, "userId", name, phone, line1, line2, city, state, pincode, "isDefault")
            values (:id, :u, :name, :phone, :l1, :l2, :city, :state, :pin, :def)
            """)
        .param("id", id).param("u", userId).param("name", a.name()).param("phone", a.phone()).param("l1", a.line1())
        .param("l2", line2(a.line2())).param("city", a.city()).param("state", a.state()).param("pin", a.pincode()).param("def", makeDefault)
        .update();
    return id;
  }

  private void clearDefault(String userId) {
    jdbc.sql("update \"Address\" set \"isDefault\" = false where \"userId\" = :u and \"isDefault\"").param("u", userId).update();
  }

  private AddressView view(String userId, String id) {
    return list(userId).stream().filter(a -> a.id().equals(id)).findFirst().orElseThrow();
  }

  @Transactional
  public AddressView create(String userId, PaymentDtos.SavedAddress a) {
    lock(userId);
    long have = count(userId);
    if (have >= MAX) throw ApiException.badRequest("You can save up to " + MAX + " addresses. Delete one to add another.");
    String id = insert(userId, a, Boolean.TRUE.equals(a.isDefault()) || have == 0);
    return view(userId, id);
  }

  @Transactional
  public AddressView update(String userId, String id, PaymentDtos.SavedAddress a) {
    lock(userId);
    requireOwned(userId, id);
    jdbc.sql("""
            update "Address" set name = :name, phone = :phone, line1 = :l1, line2 = :l2, city = :city, state = :state, pincode = :pin
            where id = :id and "userId" = :u
            """)
        .param("name", a.name()).param("phone", a.phone()).param("l1", a.line1()).param("l2", line2(a.line2()))
        .param("city", a.city()).param("state", a.state()).param("pin", a.pincode()).param("id", id).param("u", userId).update();
    if (Boolean.TRUE.equals(a.isDefault())) makeDefault(userId, id);
    return view(userId, id);
  }

  @Transactional
  public List<AddressView> setDefault(String userId, String id) {
    lock(userId);
    requireOwned(userId, id);
    makeDefault(userId, id);
    return list(userId);
  }

  private void makeDefault(String userId, String id) {
    clearDefault(userId);
    jdbc.sql("update \"Address\" set \"isDefault\" = true where id = :id and \"userId\" = :u").param("id", id).param("u", userId).update();
  }

  @Transactional
  public void delete(String userId, String id) {
    lock(userId);
    boolean wasDefault = requireOwned(userId, id);
    jdbc.sql("delete from \"Address\" where id = :id and \"userId\" = :u").param("id", id).param("u", userId).update();
    if (wasDefault) {
      // The newest remaining address takes over, so there is always a default while any address exists.
      jdbc.sql("""
              update "Address" set "isDefault" = true where id = (
                select id from "Address" where "userId" = :u order by "createdAt" desc, id limit 1)
              """).param("u", userId).update();
    }
  }

  /** Called at checkout when the customer ticked "save this address". Skips duplicates and a full address book. */
  @Transactional
  public void saveFromCheckout(String userId, PaymentDtos.Address a) {
    lock(userId);
    long have = count(userId);
    if (have >= MAX) return;
    boolean duplicate = jdbc.sql("""
            select count(*) from "Address" where "userId" = :u and name = :name and phone = :phone and line1 = :l1
              and coalesce(line2, '') = :l2 and city = :city and state = :state and pincode = :pin
            """)
        .param("u", userId).param("name", a.name()).param("phone", a.phone()).param("l1", a.line1())
        .param("l2", line2(a.line2()) == null ? "" : line2(a.line2())).param("city", a.city()).param("state", a.state())
        .param("pin", a.pincode()).query(Long.class).single() > 0;
    if (duplicate) return;
    insert(userId, new PaymentDtos.SavedAddress(a.name(), a.phone(), a.line1(), a.line2(), a.city(), a.state(), a.pincode(), false), have == 0);
  }

  /** Returns whether the address is the default; 404 if it is not this customer's. */
  private boolean requireOwned(String userId, String id) {
    return jdbc.sql("select \"isDefault\" from \"Address\" where id = :id and \"userId\" = :u")
        .param("id", id).param("u", userId).query(Boolean.class).optional()
        .orElseThrow(() -> ApiException.notFound("Address not found"));
  }
}
