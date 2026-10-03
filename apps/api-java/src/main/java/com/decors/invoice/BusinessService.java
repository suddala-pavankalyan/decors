package com.decors.invoice;

import com.decors.domain.Category;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The seller's details and GST rates, edited by the admin and printed on invoices. */
@Service
public class BusinessService {
  public record Business(String legalName, String addressLines, String gstin, String stateName, String stateCode, String contactEmail,
      String invoicePrefix, int shippingGstPercent) {
    public boolean registered() { return gstin != null && !gstin.isBlank(); }
  }

  public record RateRow(int ratePercent, String hsn) {}

  public record Settings(Business business, Map<String, RateRow> rates) {}

  private final JdbcClient jdbc;

  public BusinessService(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public Business business() {
    return jdbc.sql("select \"legalName\", \"addressLines\", gstin, \"stateName\", \"stateCode\", \"contactEmail\", \"invoicePrefix\", \"shippingGstPercent\" from \"Business\" where id = 1")
        .query((rs, n) -> new Business(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6),
            rs.getString(7), rs.getInt(8))).single();
  }

  /** Rates keyed by category slug ("wedding-cards"), in the form the website uses. */
  @Transactional(readOnly = true)
  public Map<Category, InvoiceCalculator.Rate> rates() {
    Map<Category, InvoiceCalculator.Rate> out = new EnumMap<>(Category.class);
    jdbc.sql("select category::text as c, \"ratePercent\", hsn from \"GstRate\"")
        .query((rs, n) -> Map.entry(Category.valueOf(rs.getString("c")), new InvoiceCalculator.Rate(rs.getInt(2), rs.getString(3))))
        .list().forEach(e -> out.put(e.getKey(), e.getValue()));
    return out;
  }

  @Transactional(readOnly = true)
  public Settings settings() {
    Map<String, RateRow> rates = new LinkedHashMap<>();
    for (Category c : Category.values()) {
      InvoiceCalculator.Rate r = rates().getOrDefault(c, InvoiceCalculator.UNKNOWN);
      rates.put(c.slug(), new RateRow(r.percent(), r.hsn()));
    }
    return new Settings(business(), rates);
  }

  @Transactional
  public Settings update(Business b, Map<String, RateRow> rates) {
    jdbc.sql("""
            update "Business" set "legalName" = :n, "addressLines" = :a, gstin = :g, "stateName" = :sn, "stateCode" = :sc,
                   "contactEmail" = :e, "invoicePrefix" = :p, "shippingGstPercent" = :s where id = 1
            """)
        .param("n", b.legalName()).param("a", b.addressLines()).param("g", b.gstin() == null || b.gstin().isBlank() ? null : b.gstin())
        .param("sn", b.stateName()).param("sc", b.stateCode()).param("e", b.contactEmail() == null || b.contactEmail().isBlank() ? null : b.contactEmail())
        .param("p", b.invoicePrefix()).param("s", b.shippingGstPercent()).update();
    for (Category c : Category.values()) {
      RateRow r = rates.get(c.slug());
      if (r == null) continue;
      jdbc.sql("update \"GstRate\" set \"ratePercent\" = :r, hsn = :h where category = cast(:c as \"Category\")")
          .param("r", r.ratePercent()).param("h", r.hsn()).param("c", c.name()).update();
    }
    return settings();
  }
}
