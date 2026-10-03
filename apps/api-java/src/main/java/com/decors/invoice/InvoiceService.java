package com.decors.invoice;

import com.decors.common.ApiException;
import com.decors.domain.OrderItem;
import com.decors.domain.OrderStatus;
import com.decors.domain.ShopOrder;
import com.decors.repo.Repositories.OrderItemRepository;
import com.decors.repo.Repositories.OrderRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Issues invoices. An invoice is issued when the goods are dispatched, so only shipped or delivered orders have one,
 * and an order can no longer be cancelled by then: nothing issued ever needs to be taken back.
 */
@Service
public class InvoiceService {
  static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");

  public record Pdf(String filename, byte[] bytes) {}

  private final OrderRepository orders;
  private final OrderItemRepository orderItems;
  private final BusinessService business;
  private final JdbcClient jdbc;
  private final TransactionTemplate tx;

  public InvoiceService(OrderRepository orders, OrderItemRepository orderItems, BusinessService business, JdbcClient jdbc, TransactionTemplate tx) {
    this.tx = tx;
    this.orders = orders;
    this.orderItems = orderItems;
    this.business = business;
    this.jdbc = jdbc;
  }

  /** April-March financial year of a date, written like "26-27". */
  static String financialYear(LocalDate d) {
    int start = d.getMonthValue() >= 4 ? d.getYear() : d.getYear() - 1;
    return String.format("%02d-%02d", start % 100, (start + 1) % 100);
  }

  /** Gives the order its invoice number the first time it is needed; the same number is returned ever after. Run inside a transaction. */
  ShopOrder issue(String orderId, String prefix) {
    ShopOrder o = jdbc.sql("select id from \"Order\" where id = :id for update").param("id", orderId).query(String.class).optional()
        .flatMap(id -> orders.findById(id)).orElseThrow(() -> ApiException.notFound("Order not found"));
    if (o.status != OrderStatus.SHIPPED && o.status != OrderStatus.DELIVERED) {
      throw ApiException.conflict(o.status == OrderStatus.CANCELLED
          ? "A cancelled order has no invoice" : "The invoice is available once your order has shipped");
    }
    if (o.invoiceNumber == null) {
      LocalDate today = LocalDate.now(SHOP_ZONE);
      String fy = financialYear(today);
      int seq = jdbc.sql("""
              insert into "InvoiceCounter" (fy, last) values (:fy, 1)
              on conflict (fy) do update set last = "InvoiceCounter".last + 1 returning last
              """).param("fy", fy).query(Integer.class).single();
      String number = prefix + "/" + fy + "/" + String.format("%05d", seq);
      jdbc.sql("update \"Order\" set \"invoiceNumber\" = :n, \"invoiceDate\" = :d where id = :id")
          .param("n", number).param("d", today).param("id", orderId).update();
      o.invoiceNumber = number;
      o.invoiceDate = today;
    }
    return o;
  }

  public Pdf invoice(String orderId) {
    BusinessService.Business seller = business.business();
    ShopOrder o = tx.execute(s -> issue(orderId, seller.invoicePrefix()));
    List<OrderItem> items = orderItems.findByOrderIdInOrderByIdAsc(List.of(orderId));
    var rates = business.rates();
    boolean intra = seller.stateName().trim().equalsIgnoreCase(o.shipState.trim());
    var calc = InvoiceCalculator.compute(
        items.stream().map(i -> new InvoiceCalculator.Item(i.name, i.qty, i.unitPricePaise, i.category)).toList(),
        o.discountPaise, o.shippingPaise, c -> rates.getOrDefault(c, InvoiceCalculator.UNKNOWN), seller.shippingGstPercent(), intra, seller.registered());
    var buyer = new InvoicePdf.Party(o.shipName, o.shipLine1, o.shipLine2, o.shipCity + ", " + o.shipState + " " + o.shipPincode, o.shipPhone);
    var data = new InvoicePdf.Data(o.invoiceNumber, o.invoiceDate, o.id, seller, buyer, o.shipState, calc, o.subtotalPaise, o.discountPaise,
        o.couponCode, o.shippingPaise);
    return new Pdf("invoice-" + o.invoiceNumber.replace('/', '-') + ".pdf", InvoicePdf.render(data));
  }
}
