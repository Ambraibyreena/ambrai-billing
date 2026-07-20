function currency(n) {
  return `Rs. ${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Builds a simple 80mm-receipt-style printable invoice and opens the browser print dialog.
// `invoice` shape: { invoiceNumber, date, customer, items, subtotal, billDiscountAmount, gstAmount, total, payments }
export function printInvoice(invoice) {
  const dateStr = new Date(invoice.date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemRows = (invoice.items || [])
    .map(
      (i) => `
      <tr>
        <td>${i.name}${i.size ? " · " + i.size : ""}${i.color ? " · " + i.color : ""}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${currency(i.price)}</td>
        <td style="text-align:right">${currency(i.lineTotal ?? i.line_total)}</td>
      </tr>`
    )
    .join("");

  const paymentRows = (invoice.payments || [])
    .map((p) => `<tr><td>${p.method}</td><td style="text-align:right">${currency(p.amount)}</td></tr>`)
    .join("");

  const html = `
    <html>
      <head>
        <title>${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Georgia, serif; width: 300px; margin: 0 auto; padding: 16px; color: #222; }
          h1 { text-align: center; font-size: 20px; margin: 0 0 2px; }
          .sub { text-align: center; font-size: 11px; color: #777; margin-bottom: 12px; }
          .meta { font-size: 11px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { text-align: left; border-bottom: 1px solid #ccc; padding-bottom: 4px; font-size: 10px; text-transform: uppercase; color: #777; }
          td { padding: 4px 0; border-bottom: 1px dashed #eee; }
          .totals td { border: none; padding: 2px 0; }
          .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #333; padding-top: 6px !important; }
          .footer { text-align: center; font-size: 10px; color: #999; margin-top: 16px; }
        </style>
      </head>
      <body>
        <h1>Ambrai</h1>
        <div class="sub">by Reena Mahendru</div>
        <div class="meta">
          Invoice: <b>${invoice.invoiceNumber}</b><br/>
          Date: ${dateStr}<br/>
          ${invoice.customer ? `Customer: ${invoice.customer.name}${invoice.customer.phone && invoice.customer.phone !== "—" ? " · " + invoice.customer.phone : ""}` : "Walk-in customer"}
        </div>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <table class="totals" style="margin-top:8px">
          <tr><td>Subtotal</td><td style="text-align:right">${currency(invoice.subtotal)}</td></tr>
          ${invoice.billDiscountAmount ? `<tr><td>Discount</td><td style="text-align:right">-${currency(invoice.billDiscountAmount)}</td></tr>` : ""}
          <tr><td>GST (incl.)</td><td style="text-align:right">${currency(invoice.gstAmount)}</td></tr>
          <tr class="grand"><td>Total</td><td style="text-align:right">${currency(invoice.total)}</td></tr>
        </table>
        ${
          invoice.payments && invoice.payments.length
            ? `<table class="totals" style="margin-top:8px"><thead><tr><th>Payment</th><th style="text-align:right">Amount</th></tr></thead><tbody>${paymentRows}</tbody></table>`
            : ""
        }
        <div class="footer">Thank you for shopping with us ♥</div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=380,height=600");
  if (!printWindow) {
    alert("Please allow pop-ups to print the invoice.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
