export type Receipt = {
  code: string;
  customerName: string;
  planLabel: string;
  dateLabel: string;
  details: string;
  timeRange: string | null;
  quantity: string;
  unitPrice: number;
  unit: string;
  total: number;
  issuedAt: string;
  qrDataUrl: string;
  deskCode?: string;
  cardNumber?: string;
  cardHolder?: string;
  statusLabel?: string;
  paymentLabel?: string;
  paymentStatusLabel?: string;
};

/**
 * Builds a standalone, print-ready A4 HTML document for the reservation receipt.
 * Rendered into a hidden iframe and sent to the browser's PDF engine so Persian
 * text stays vector and correctly shaped.
 */
export function buildReceiptHtml(receipt: Receipt, formatToman: (v: number) => string) {
  const row = (label: string, value: string, ltr = false) => `
    <div class="row">
      <span class="label">${label}</span>
      <span class="value"${ltr ? ' dir="ltr"' : ""}>${value}</span>
    </div>`;

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>aghaz-receipt-${receipt.code}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Vazirmatn, system-ui, sans-serif;
    color: #0b0b0f;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 1px solid #e6e7ec; padding-bottom: 18px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .brand-sub { margin-top: 4px; font-size: 12px; color: #6b6f7b; }
  .meta { text-align: left; }
  .meta .cap { font-size: 10.5px; letter-spacing: 0.12em; color: #6b6f7b; }
  .code { margin-top: 4px; font-family: ui-monospace, monospace; font-size: 18px; font-weight: 700; }
  .issued { margin-top: 4px; font-size: 11.5px; color: #6b6f7b; }
  h2 { margin: 30px 0 6px; font-size: 13px; font-weight: 700; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    border-bottom: 1px solid #eff0f4; padding: 9px 0; font-size: 13px; }
  .label { color: #6b6f7b; }
  .value { font-weight: 500; }
  .total { margin-top: 16px; display: flex; align-items: center; justify-content: space-between;
    background: #f5f6f9; border-radius: 12px; padding: 16px 20px; }
  .total .t-label { font-size: 14px; font-weight: 500; }
  .total .t-value { font-size: 18px; font-weight: 700; }
  .qr { margin-top: 26px; display: flex; align-items: center; gap: 18px;
    border: 1px solid #e6e7ec; border-radius: 14px; padding: 16px 20px; }
  .qr img { width: 118px; height: 118px; }
  .qr .qr-title { font-size: 13px; font-weight: 700; }
  .qr .qr-sub { margin-top: 6px; font-size: 11.5px; line-height: 1.9; color: #6b6f7b; }
  footer { margin-top: 36px; border-top: 1px solid #e6e7ec; padding-top: 16px;
    font-size: 11.5px; line-height: 1.9; color: #6b6f7b; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">آغاز</div>
      <div class="brand-sub">تجربه‌ی کار اشتراکی هوشمند</div>
    </div>
    <div class="meta">
      <div class="cap">رسید رزرو</div>
      <div class="code" dir="ltr">${receipt.code}</div>
      <div class="issued">${receipt.issuedAt}</div>
    </div>
  </div>

  <h2>جزئیات رزرو</h2>
  ${row("نام و نام خانوادگی", receipt.customerName)}
  ${row("پلن", receipt.planLabel)}
  ${row("تاریخ", receipt.dateLabel)}
  ${receipt.timeRange ? row("بازه ساعتی", receipt.timeRange, true) : ""}
  ${row("مدت", receipt.quantity)}
  ${row("فضا", receipt.deskCode ? `میز ${receipt.deskCode}` : "میز اشتراکی")}
  ${row("وضعیت", receipt.statusLabel ?? "در انتظار تأیید")}
  ${row("پرداخت", receipt.paymentLabel ?? receipt.paymentStatusLabel ?? "پرداخت‌نشده")}
  ${receipt.cardNumber ? row("شماره کارت (کارت به کارت)", receipt.cardNumber, true) : ""}
  ${receipt.cardHolder ? row("به نام", receipt.cardHolder) : ""}

  <h2>خلاصه مبلغ</h2>
  ${row(`تعرفه (${formatToman(receipt.unitPrice)} / ${receipt.unit})`, receipt.quantity)}
  ${row("مالیات و کارمزد", "۰ تومان")}

  <div class="total">
    <span class="t-label">مبلغ قابل پرداخت</span>
    <span class="t-value">${formatToman(receipt.total)}</span>
  </div>

  <div class="qr">
    <img src="${receipt.qrDataUrl}" alt="کد QR چک‌این" />
    <div>
      <div class="qr-title">چک‌این سریع</div>
      <div class="qr-sub">
        این کد QR را در ورودی آغاز اسکن کنید تا بدون معطلی چک‌این شوید.
        <br />کد رزرو: <span dir="ltr">${receipt.code}</span>
      </div>
    </div>
  </div>

  <footer>
    برای ورود، شماره رزرو را در پنل درب هوشمند وارد کنید. این رسید به‌عنوان سند رزرو معتبر است.
    <br />
    aghaz.space · پشتیبانی: ۰۲۱-۰۰۰۰۰۰۰۰
  </footer>
</body>
</html>`;
}
