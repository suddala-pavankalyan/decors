package com.decors.invoice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decors.domain.Category;
import com.decors.invoice.InvoiceCalculator.Item;
import com.decors.invoice.InvoiceCalculator.Rate;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class InvoiceCalculatorTest {
  private static Rate rate(Category c) {
    return c == Category.WEDDING_CARDS ? new Rate(12, "4909") : new Rate(18, "8306");
  }

  @Test
  void splitsInclusivePricesIntoTaxableValueAndTax() {
    var r = InvoiceCalculator.compute(List.of(new Item("Card", 1, 11200, Category.WEDDING_CARDS)), 0, 0, InvoiceCalculatorTest::rate, 18, false, true);
    var l = r.lines().get(0);
    assertEquals(10000, l.taxablePaise());
    assertEquals(1200, l.igstPaise());
    assertEquals(0, l.cgstPaise());
    assertEquals(11200, r.totalPaise());
  }

  @Test
  void sameStateSplitsTheTaxInHalf() {
    var r = InvoiceCalculator.compute(List.of(new Item("Card", 1, 11200, Category.WEDDING_CARDS)), 0, 0, InvoiceCalculatorTest::rate, 18, true, true);
    var l = r.lines().get(0);
    assertEquals(600, l.cgstPaise());
    assertEquals(600, l.sgstPaise());
    assertEquals(0, l.igstPaise());
    assertTrue(r.intraState());
  }

  @Test
  void anOddTaxAmountKeepsEveryPaise() {
    var r = InvoiceCalculator.compute(List.of(new Item("Thing", 1, 4500, Category.WALL_DECOR)), 0, 0, InvoiceCalculatorTest::rate, 18, true, true);
    var l = r.lines().get(0);
    assertEquals(4500, l.taxablePaise() + l.cgstPaise() + l.sgstPaise());
  }

  @Test
  void discountIsSpreadAcrossItemsAndTakenOffExactly() {
    var items = List.of(new Item("A", 1, 3333, Category.WEDDING_CARDS), new Item("B", 2, 3333, Category.WALL_DECOR), new Item("C", 1, 1001, null));
    int gross = 3333 + 6666 + 1001;
    for (int discount : new int[] {0, 1, 7, 999, 5000, gross - 100}) {
      var r = InvoiceCalculator.compute(items, discount, 4900, InvoiceCalculatorTest::rate, 18, true, true);
      assertEquals(gross - discount + 4900, r.totalPaise(), "discount " + discount);
      for (var l : r.lines()) assertEquals(l.amountPaise(), l.taxablePaise() + l.taxPaise());
    }
  }

  @Test
  void shippingIsTaxedAtItsOwnRateAndIsOptional() {
    var with = InvoiceCalculator.compute(List.of(new Item("A", 1, 10000, Category.WALL_DECOR)), 0, 5900, InvoiceCalculatorTest::rate, 18, false, true);
    assertEquals(2, with.lines().size());
    assertEquals("Shipping", with.lines().get(1).description());
    assertEquals(900, with.lines().get(1).igstPaise());
    var without = InvoiceCalculator.compute(List.of(new Item("A", 1, 10000, Category.WALL_DECOR)), 0, 0, InvoiceCalculatorTest::rate, 18, false, true);
    assertEquals(1, without.lines().size());
  }

  @Test
  void aShopWithoutGstinChargesNoTax() {
    var r = InvoiceCalculator.compute(List.of(new Item("A", 2, 5000, Category.WALL_DECOR)), 0, 4900, InvoiceCalculatorTest::rate, 18, true, false);
    assertFalse(r.registered());
    assertEquals(0, r.cgstPaise() + r.sgstPaise() + r.igstPaise());
    assertEquals(r.totalPaise(), r.taxablePaise());
    assertEquals(14900, r.totalPaise());
  }

  @Test
  void rupeesUseIndianGrouping() {
    assertEquals("Rs. 0.00", InvoicePdf.rs(0));
    assertEquals("Rs. 999.50", InvoicePdf.rs(99950));
    assertEquals("Rs. 1,234.00", InvoicePdf.rs(123400));
    assertEquals("Rs. 12,34,567.89", InvoicePdf.rs(123456789));
    assertEquals("Rs. 1,00,000.00", InvoicePdf.rs(10000000));
  }

  @Test
  void financialYearRunsAprilToMarch() {
    assertEquals("26-27", InvoiceService.financialYear(LocalDate.of(2026, 4, 1)));
    assertEquals("25-26", InvoiceService.financialYear(LocalDate.of(2026, 3, 31)));
    assertEquals("99-00", InvoiceService.financialYear(LocalDate.of(2099, 12, 1)));
  }

  @Test
  void textOutsideTheBuiltInFontBecomesQuestionMarks() {
    assertEquals("Café ??", InvoicePdf.clean("Café हि"));
  }
}
