package com.decors.invoice;

import com.decors.invoice.InvoiceCalculator.Line;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Draws a tax invoice as an A4 PDF. Uses the built-in Helvetica, so amounts are written as "Rs." (it has no rupee sign). */
public final class InvoicePdf {
  private InvoicePdf() {}

  public record Party(String name, String line1, String line2, String cityStateZip, String phone) {}

  public record Data(String number, LocalDate date, String orderId, BusinessService.Business seller, Party buyer, String buyerState,
      InvoiceCalculator.Result calc, int subtotalPaise, int discountPaise, String couponCode, int shippingPaise) {}

  private static final Color INK = new Color(0x1e, 0x29, 0x3b);
  private static final Color MUTED = new Color(0x64, 0x74, 0x8b);
  private static final Color HEAD = new Color(0xf1, 0xf5, 0xf9);
  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");

  static Font font(float size, boolean bold, Color color) {
    return FontFactory.getFont(bold ? FontFactory.HELVETICA_BOLD : FontFactory.HELVETICA, size, Font.NORMAL, color);
  }

  /** "Rs. 1,234.50" in the Indian grouping (12,34,567.00). */
  public static String rs(int paise) {
    String sign = paise < 0 ? "-" : "";
    int abs = Math.abs(paise);
    String whole = Integer.toString(abs / 100);
    if (whole.length() > 3) {
      String head = whole.substring(0, whole.length() - 3);
      StringBuilder g = new StringBuilder();
      for (int i = 0; i < head.length(); i++) {
        if (i > 0 && (head.length() - i) % 2 == 0) g.append(',');
        g.append(head.charAt(i));
      }
      whole = g + "," + whole.substring(whole.length() - 3);
    }
    return sign + "Rs. " + whole + "." + String.format("%02d", abs % 100);
  }

  /** The built-in fonts only cover Western characters; swap anything else for '?' rather than dropping text silently. */
  static String clean(String s) {
    if (s == null) return "";
    StringBuilder b = new StringBuilder();
    for (char c : s.toCharArray()) b.append(c >= 32 && c <= 255 || c == '\n' || c == '–' || c == '—' || c == '’' ? c : '?');
    return b.toString();
  }

  private static PdfPCell cell(String text, Font f, int align, boolean border) {
    PdfPCell c = new PdfPCell(new Phrase(clean(text), f));
    c.setHorizontalAlignment(align);
    c.setPadding(5);
    c.setBorder(border ? Rectangle.BOTTOM : Rectangle.NO_BORDER);
    c.setBorderColor(new Color(0xe2, 0xe8, 0xf0));
    return c;
  }

  private static PdfPCell head(String text, int align) {
    PdfPCell c = cell(text, font(8, true, MUTED), align, false);
    c.setBackgroundColor(HEAD);
    return c;
  }

  public static byte[] render(Data d) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
    try {
      PdfWriter.getInstance(doc, out);
      doc.addTitle("Invoice " + d.number());
      doc.addCreator("Decors");
      doc.open();

      boolean reg = d.calc().registered();
      PdfPTable top = new PdfPTable(new float[] {1.4f, 1f});
      top.setWidthPercentage(100);
      PdfPCell seller = new PdfPCell();
      seller.setBorder(Rectangle.NO_BORDER);
      seller.addElement(new Paragraph(clean(d.seller().legalName()), font(16, true, INK)));
      for (String l : d.seller().addressLines().split("\\R")) if (!l.isBlank()) seller.addElement(new Paragraph(clean(l.trim()), font(9, false, MUTED)));
      if (reg) seller.addElement(new Paragraph("GSTIN: " + clean(d.seller().gstin()), font(9, true, INK)));
      if (d.seller().contactEmail() != null) seller.addElement(new Paragraph(clean(d.seller().contactEmail()), font(9, false, MUTED)));
      top.addCell(seller);
      PdfPCell meta = new PdfPCell();
      meta.setBorder(Rectangle.NO_BORDER);
      Paragraph title = new Paragraph(reg ? "TAX INVOICE" : "INVOICE", font(16, true, INK));
      title.setAlignment(Element.ALIGN_RIGHT);
      meta.addElement(title);
      for (String[] kv : new String[][] {{"Invoice no.", d.number()}, {"Date", DATE.format(d.date())}, {"Order", d.orderId()}}) {
        Paragraph p = new Paragraph(kv[0] + ": " + clean(kv[1]), font(9, false, INK));
        p.setAlignment(Element.ALIGN_RIGHT);
        meta.addElement(p);
      }
      top.addCell(meta);
      doc.add(top);

      Paragraph billTo = new Paragraph("\nBilled and shipped to", font(8, true, MUTED));
      doc.add(billTo);
      Party b = d.buyer();
      doc.add(new Paragraph(clean(b.name()), font(11, true, INK)));
      doc.add(new Paragraph(clean(b.line1() + (b.line2() == null || b.line2().isBlank() ? "" : ", " + b.line2())), font(9, false, INK)));
      doc.add(new Paragraph(clean(b.cityStateZip()) + "   Phone: " + clean(b.phone()), font(9, false, INK)));
      if (reg) doc.add(new Paragraph("Place of supply: " + clean(d.buyerState()) + (d.calc().intraState() ? " (same state as the seller)" : ""), font(9, false, MUTED)));

      boolean intra = d.calc().intraState();
      float[] widths = !reg ? new float[] {3.2f, 0.6f, 1.4f} : intra ? new float[] {2.0f, 0.8f, 0.5f, 1.3f, 1.5f, 1.5f, 1.4f} : new float[] {2.6f, 0.9f, 0.5f, 1.4f, 1.6f, 1.4f};
      PdfPTable t = new PdfPTable(widths);
      t.setWidthPercentage(100);
      t.setSpacingBefore(14);
      t.setHeaderRows(1);
      t.addCell(head("ITEM", Element.ALIGN_LEFT));
      if (reg) t.addCell(head("HSN", Element.ALIGN_LEFT));
      t.addCell(head("QTY", Element.ALIGN_RIGHT));
      if (reg) {
        t.addCell(head("TAXABLE", Element.ALIGN_RIGHT));
        if (intra) { t.addCell(head("CGST", Element.ALIGN_RIGHT)); t.addCell(head("SGST", Element.ALIGN_RIGHT)); }
        else t.addCell(head("IGST", Element.ALIGN_RIGHT));
      }
      t.addCell(head("AMOUNT", Element.ALIGN_RIGHT));
      Font body = font(9, false, INK);
      for (Line l : d.calc().lines()) {
        t.addCell(cell(l.description(), body, Element.ALIGN_LEFT, true));
        if (reg) t.addCell(cell(l.hsn(), body, Element.ALIGN_LEFT, true));
        t.addCell(cell(Integer.toString(l.qty()), body, Element.ALIGN_RIGHT, true));
        if (reg) {
          t.addCell(cell(rs(l.taxablePaise()), body, Element.ALIGN_RIGHT, true));
          String half = l.ratePercent() % 2 == 0 ? Integer.toString(l.ratePercent() / 2) : String.format("%.1f", l.ratePercent() / 2.0);
          if (intra) {
            t.addCell(cell(rs(l.cgstPaise()) + "\n(" + half + "%)", body, Element.ALIGN_RIGHT, true));
            t.addCell(cell(rs(l.sgstPaise()) + "\n(" + half + "%)", body, Element.ALIGN_RIGHT, true));
          } else {
            t.addCell(cell(rs(l.igstPaise()) + "\n(" + l.ratePercent() + "%)", body, Element.ALIGN_RIGHT, true));
          }
        }
        t.addCell(cell(rs(l.amountPaise()), body, Element.ALIGN_RIGHT, true));
      }
      doc.add(t);

      PdfPTable sum = new PdfPTable(new float[] {3f, 1.4f});
      sum.setWidthPercentage(46);
      sum.setHorizontalAlignment(Element.ALIGN_RIGHT);
      sum.setSpacingBefore(10);
      Font sf = font(9, false, INK);
      List<String[]> rows = new java.util.ArrayList<>();
      rows.add(new String[] {"Items", rs(d.subtotalPaise())});
      if (d.discountPaise() > 0) rows.add(new String[] {"Discount" + (d.couponCode() == null ? "" : " (" + d.couponCode() + ")"), "-" + rs(d.discountPaise())});
      if (d.shippingPaise() > 0) rows.add(new String[] {"Shipping", rs(d.shippingPaise())});
      if (reg) {
        rows.add(new String[] {"Taxable value", rs(d.calc().taxablePaise())});
        if (intra) { rows.add(new String[] {"CGST", rs(d.calc().cgstPaise())}); rows.add(new String[] {"SGST", rs(d.calc().sgstPaise())}); }
        else rows.add(new String[] {"IGST", rs(d.calc().igstPaise())});
      }
      for (String[] r : rows) { sum.addCell(cell(r[0], sf, Element.ALIGN_LEFT, false)); sum.addCell(cell(r[1], sf, Element.ALIGN_RIGHT, false)); }
      sum.addCell(cell("Total paid", font(11, true, INK), Element.ALIGN_LEFT, true));
      sum.addCell(cell(rs(d.calc().totalPaise()), font(11, true, INK), Element.ALIGN_RIGHT, true));
      doc.add(sum);

      Paragraph foot = new Paragraph(reg ? "Prices include GST. This is a computer-generated invoice and needs no signature."
          : "The seller is not registered under GST, so no tax is charged. This is a computer-generated invoice and needs no signature.", font(8, false, MUTED));
      foot.setSpacingBefore(28);
      doc.add(foot);
      doc.close();
    } catch (DocumentException e) {
      throw new IllegalStateException("Could not draw the invoice: " + e.getMessage(), e);
    }
    return out.toByteArray();
  }
}
