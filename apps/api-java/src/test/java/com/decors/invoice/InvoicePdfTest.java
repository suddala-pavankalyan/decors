package com.decors.invoice;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decors.domain.Category;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class InvoicePdfTest {
  private static InvoicePdf.Data sample(boolean registered, boolean intra) {
    var seller = new BusinessService.Business("Decors Pvt Ltd", "12 Brigade Road\nBengaluru 560001", registered ? "29ABCDE1234F1Z5" : null,
        "Karnataka", "29", "billing@decors.test", "INV", 18);
    var calc = InvoiceCalculator.compute(
        List.of(new InvoiceCalculator.Item("Floral Gold Invitation", 2, 4500, Category.WEDDING_CARDS),
            new InvoiceCalculator.Item("Matte Emulsion 4L", 1, 189900, Category.PAINTS)),
        2000, 4900, c -> c == Category.WEDDING_CARDS ? new InvoiceCalculator.Rate(12, "4909") : new InvoiceCalculator.Rate(18, "3208"), 18, intra, registered);
    var buyer = new InvoicePdf.Party("Asha Rao", "12 MG Road", "Floor 2", "Bengaluru, Karnataka 560001", "9876543210");
    return new InvoicePdf.Data("INV/26-27/00001", LocalDate.of(2026, 10, 3), "order123", seller, buyer, "Karnataka", calc, 198900, 2000, "SAVE10", 4900);
  }

  @Test
  void rendersAValidPdfInEveryVariant() throws Exception {
    for (boolean registered : new boolean[] {true, false}) {
      for (boolean intra : new boolean[] {true, false}) {
        byte[] pdf = InvoicePdf.render(sample(registered, intra));
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.ISO_8859_1));
        assertTrue(pdf.length > 1500);
      }
    }
    // Kept for a quick look: target/sample-invoice.pdf
    Files.write(Path.of("target", "sample-invoice.pdf"), InvoicePdf.render(sample(true, true)));
  }
}
