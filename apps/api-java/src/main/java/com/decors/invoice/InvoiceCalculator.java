package com.decors.invoice;

import com.decors.domain.Category;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/**
 * Splits GST out of GST-inclusive prices, the way an Indian tax invoice shows it.
 *
 * <p>The coupon discount is spread over the items in proportion to what each costs, tax is worked out per line
 * (CGST + SGST when the buyer is in the seller's state, IGST otherwise), and everything is in whole paise, so the
 * lines always add up to exactly what the customer paid.
 */
public final class InvoiceCalculator {
  private InvoiceCalculator() {}

  public record Item(String name, int qty, int unitPricePaise, Category category) {}

  public record Rate(int percent, String hsn) {}

  public record Line(String description, String hsn, int qty, int amountPaise, int ratePercent, int taxablePaise, int cgstPaise,
      int sgstPaise, int igstPaise) {
    public int taxPaise() { return cgstPaise + sgstPaise + igstPaise; }
  }

  public record Result(List<Line> lines, int taxablePaise, int cgstPaise, int sgstPaise, int igstPaise, int totalPaise, boolean intraState,
      boolean registered) {}

  static final Rate UNKNOWN = new Rate(18, "");

  public static Result compute(List<Item> items, int discountPaise, int shippingPaise, Function<Category, Rate> rates,
      int shippingGstPercent, boolean intraState, boolean registered) {
    long gross = 0;
    for (Item i : items) gross += (long) i.unitPricePaise() * i.qty();
    int[] after = new int[items.size()];
    long allocated = 0;
    int largest = 0;
    for (int n = 0; n < items.size(); n++) {
      long g = (long) items.get(n).unitPricePaise() * items.get(n).qty();
      long share = gross == 0 ? 0 : discountPaise * g / gross;
      after[n] = (int) (g - share);
      allocated += share;
      if (g > (long) items.get(largest).unitPricePaise() * items.get(largest).qty()) largest = n;
    }
    // Whatever rounding left over comes off the biggest line, so the discount is taken off exactly.
    if (!items.isEmpty()) after[largest] -= (int) (discountPaise - allocated);

    List<Line> lines = new ArrayList<>();
    for (int n = 0; n < items.size(); n++) {
      Item i = items.get(n);
      Rate r = i.category() == null ? UNKNOWN : rates.apply(i.category());
      lines.add(line(i.name(), r.hsn(), i.qty(), after[n], registered ? r.percent() : 0, intraState));
    }
    if (shippingPaise > 0) lines.add(line("Shipping", "9965", 1, shippingPaise, registered ? shippingGstPercent : 0, intraState));

    int taxable = 0, cgst = 0, sgst = 0, igst = 0, total = 0;
    for (Line l : lines) {
      taxable += l.taxablePaise();
      cgst += l.cgstPaise();
      sgst += l.sgstPaise();
      igst += l.igstPaise();
      total += l.amountPaise();
    }
    return new Result(lines, taxable, cgst, sgst, igst, total, intraState, registered);
  }

  static Line line(String description, String hsn, int qty, int amountPaise, int ratePercent, boolean intraState) {
    int taxable = (int) (((long) amountPaise * 100 + (100 + ratePercent) / 2) / (100 + ratePercent));
    int tax = amountPaise - taxable;
    int cgst = intraState ? tax / 2 : 0;
    int sgst = intraState ? tax - cgst : 0;
    int igst = intraState ? 0 : tax;
    return new Line(description, hsn, qty, amountPaise, ratePercent, taxable, cgst, sgst, igst);
  }
}
