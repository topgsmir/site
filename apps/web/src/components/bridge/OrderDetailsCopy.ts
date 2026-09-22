import type { Locale } from "@/lib/i18n";

const en = {
  eyebrow: "PURCHASE DETAILS", order: "Your order", back: "My orders", number: "Order number", created: "Placed on",
  progress: "Order progress", items: "Purchased items", summary: "Order summary", seller: "Your seller", total: "Order total",
  quantity: "Quantity", unit: "Unit price", itemTotal: "Item total", payment: "Payment", paid: "Paid", pending: "Awaiting payment",
  cancelledPayment: "Order cancelled", unknown: "Status unavailable", continuePayment: "Continue payment", cancel: "Cancel order",
  confirm: "Confirm delivery", close: "Go back", cancelHint: "This will cancel your unpaid order. You can place a new order later.",
  confirmHint: "Confirm only after you have received and checked all items. This marks the order as delivered.",
  working: "Please wait…", updated: "Order updated.", actionError: "We couldn’t complete this action. Refresh the order and try again.",
  error: "We couldn’t load your order.", unavailable: "This order is unavailable or you don’t have access to it.", retry: "Try again",
  refresh: "Refresh", refreshing: "Updating…", refreshError: "Couldn’t refresh. The last loaded details are still shown.",
  loading: "Loading your order", copy: "Copy", copied: "Copied", copyError: "Couldn’t copy. Select and copy the text manually.",
  chat: "Contact seller", chatHint: "Start a conversation about this order or continue your previous messages.",
  chatLoading: "Checking chat availability…", chatConfigError: "Couldn’t load chat. Try again.", chatDisabled: "Chat is currently disabled.", chatSellerUnavailable: "This seller hasn’t enabled chat yet.", chatError: "Couldn’t open the conversation. Please try again.",
  delivery: "Delivery details", recipient: "Recipient", address: "Address", postal: "Postal code", carrier: "Carrier", tracking: "Tracking code", shipped: "Shipped on",
  shippingWait: "Shipping details will appear here once your order is dispatched.", download: "Download file", downloadHint: "Opens securely in a new tab",
  remaining: "Downloads remaining", unlimited: "Unlimited downloads", exhausted: "Download limit reached", locked: "Download unavailable",
  downloadWait: "Your download will appear here when it is available.", inputs: "Submitted information", protected: "Protected after submission",
  note: "Service note", result: "Delivery result", structured: "View full result", completed: "Completed on", resultWait: "Your result will appear here when the service is complete.",
  refund: "Request a refund", reason: "Reason for request", reasonHint: "Describe the issue in 3–500 characters.", send: "Send request",
  refundSent: "Refund request submitted for review.", refundValidation: "Enter a reason between 3 and 500 characters.",
  empty: "No items are available for this order.", latest: "Last updated", live: "Updates automatically",
  steps: { placed: "Order placed", payment: "Payment", processing: "In progress", shipped: "Dispatched", ready: "Ready to receive", delivered: "Delivered" },
  types: { digital: "Digital file", service: "Service", bridge: "Online service", physical: "Physical product" },
  statuses: { pending: "Awaiting payment", paid: "Paid", processing: "In progress", shipped: "Dispatched", awaiting_confirmation: "Awaiting your confirmation", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded", waiting_payment: "Awaiting payment", queued: "Queued", submitting: "Submitting", submitted: "Submitted", polling: "Checking result", manual_required: "Under review", succeeded: "Completed", failed: "Service unsuccessful", refund_requested: "Refund under review" },
  hints: { pending: "Complete payment to start your order.", paid: "Payment received. Check your items below for delivery details.", processing: "Your seller is working on your order. Progress appears here as it changes.", shipped: "Your order is on its way. Check the shipment details below.", awaiting_confirmation: "Check your delivery, then confirm that you have received it.", delivered: "Your order is complete. Your purchase details remain available below.", cancelled: "This order has been cancelled.", refunded: "This order has been refunded.", failed: "One or more services need attention. Check the affected item below.", refund_requested: "Your refund request is under review. This does not yet mean a refund has been issued.", manual_required: "Your service needs review. Check the item below for available actions." },
};
export type OrderCopy = typeof en;
const fa: OrderCopy = {
  eyebrow: "جزئیات خرید", order: "سفارش شما", back: "سفارش‌های من", number: "شماره سفارش", created: "تاریخ ثبت",
  progress: "وضعیت سفارش", items: "اقلام سفارش", summary: "خلاصه سفارش", seller: "فروشنده سفارش", total: "مبلغ کل سفارش",
  quantity: "تعداد", unit: "قیمت واحد", itemTotal: "مبلغ", payment: "پرداخت", paid: "پرداخت‌شده", pending: "در انتظار پرداخت",
  cancelledPayment: "سفارش لغو شده", unknown: "وضعیت نامشخص", continuePayment: "ادامه پرداخت", cancel: "لغو سفارش",
  confirm: "تأیید دریافت", close: "بازگشت", cancelHint: "سفارش پرداخت‌نشده شما لغو می‌شود. بعداً می‌توانید سفارش تازه‌ای ثبت کنید.",
  confirmHint: "اگر همه اقلام سفارش را دریافت و بررسی کرده‌اید، دریافت را تأیید کنید. با این کار سفارش تحویل‌شده ثبت می‌شود.",
  working: "لطفاً صبر کنید…", updated: "سفارش به‌روز شد.", actionError: "انجام این کار ممکن نشد. سفارش را به‌روز کنید و دوباره تلاش کنید.",
  error: "سفارش بارگذاری نشد.", unavailable: "این سفارش در دسترس نیست یا اجازه مشاهده آن را ندارید.", retry: "تلاش دوباره",
  refresh: "به‌روزرسانی", refreshing: "در حال به‌روزرسانی…", refreshError: "به‌روزرسانی انجام نشد. آخرین اطلاعات دریافت‌شده را می‌بینید.",
  loading: "در حال بارگذاری سفارش", copy: "کپی", copied: "کپی شد", copyError: "کپی انجام نشد. متن را انتخاب و کپی کنید.",
  chat: "گفت‌وگو با فروشنده", chatHint: "گفت‌وگو درباره این سفارش را شروع کنید یا پیام‌های قبلی را ادامه دهید.",
  chatLoading: "در حال بررسی دسترسی به گفت‌وگو…", chatConfigError: "گفت‌وگو بارگذاری نشد. دوباره تلاش کنید.", chatDisabled: "گفت‌وگو در حال حاضر غیرفعال است.", chatSellerUnavailable: "این فروشنده هنوز گفت‌وگو را فعال نکرده است.", chatError: "گفت‌وگو باز نشد. دوباره تلاش کنید.",
  delivery: "اطلاعات ارسال", recipient: "گیرنده", address: "نشانی", postal: "کد پستی", carrier: "شرکت حمل‌ونقل", tracking: "کد رهگیری", shipped: "تاریخ ارسال",
  shippingWait: "پس از ارسال سفارش، اطلاعات مرسوله اینجا نمایش داده می‌شود.", download: "دریافت فایل", downloadHint: "در زبانه تازه باز می‌شود",
  remaining: "دفعات باقی‌مانده دریافت", unlimited: "دریافت نامحدود", exhausted: "تعداد مجاز دریافت تمام شده", locked: "دریافت در دسترس نیست",
  downloadWait: "وقتی فایل آماده دریافت باشد، از همین بخش به آن دسترسی دارید.", inputs: "اطلاعات ثبت‌شده", protected: "پس از ثبت محافظت می‌شود",
  note: "یادداشت سرویس", result: "نتیجه سرویس", structured: "مشاهده نتیجه کامل", completed: "تاریخ انجام", resultWait: "پس از انجام سرویس، نتیجه اینجا نمایش داده می‌شود.",
  refund: "درخواست بازپرداخت", reason: "دلیل درخواست", reasonHint: "مشکل را در ۳ تا ۵۰۰ نویسه توضیح دهید.", send: "ارسال درخواست",
  refundSent: "درخواست بازپرداخت برای بررسی ثبت شد.", refundValidation: "دلیل درخواست باید بین ۳ تا ۵۰۰ نویسه باشد.",
  empty: "اقلام این سفارش در دسترس نیست.", latest: "آخرین به‌روزرسانی", live: "به‌روزرسانی خودکار",
  steps: { placed: "ثبت سفارش", payment: "پرداخت", processing: "در حال انجام", shipped: "ارسال سفارش", ready: "آماده دریافت", delivered: "تحویل‌شده" },
  types: { digital: "فایل دیجیتال", service: "سرویس", bridge: "سرویس آنلاین", physical: "کالای فیزیکی" },
  statuses: { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", processing: "در حال انجام", shipped: "ارسال‌شده", awaiting_confirmation: "در انتظار تأیید شما", delivered: "تحویل‌شده", cancelled: "لغوشده", refunded: "بازپرداخت‌شده", waiting_payment: "در انتظار پرداخت", queued: "در صف انجام", submitting: "در حال ثبت", submitted: "ثبت‌شده", polling: "در حال بررسی نتیجه", manual_required: "نیازمند بررسی", succeeded: "انجام‌شده", failed: "سرویس ناموفق", refund_requested: "در حال بررسی بازپرداخت" },
  hints: { pending: "برای شروع سفارش، پرداخت را تکمیل کنید.", paid: "پرداخت دریافت شد. جزئیات دریافت هر مورد را در پایین ببینید.", processing: "فروشنده در حال انجام سفارش است. تغییر وضعیت را در همین صفحه می‌بینید.", shipped: "سفارش شما ارسال شده است. اطلاعات مرسوله را در پایین ببینید.", awaiting_confirmation: "سفارش را بررسی کنید و پس از دریافت، آن را تأیید کنید.", delivered: "سفارش شما تکمیل شده است. جزئیات خرید همچنان در دسترس شماست.", cancelled: "این سفارش لغو شده است.", refunded: "مبلغ این سفارش بازپرداخت شده است.", failed: "یک یا چند سرویس نیاز به پیگیری دارد. جزئیات مورد مربوط را در پایین ببینید.", refund_requested: "درخواست بازپرداخت در حال بررسی است؛ هنوز به معنی برگشت وجه نیست.", manual_required: "سرویس شما نیاز به بررسی دارد. گزینه‌های پیگیری را در بخش مربوط ببینید." },
};
const ar: OrderCopy = {
  eyebrow: "تفاصيل الشراء", order: "طلبك", back: "طلباتي", number: "رقم الطلب", created: "تاريخ الطلب",
  progress: "حالة الطلب", items: "عناصر الطلب", summary: "ملخص الطلب", seller: "البائع", total: "إجمالي الطلب",
  quantity: "الكمية", unit: "سعر الوحدة", itemTotal: "المبلغ", payment: "الدفع", paid: "مدفوع", pending: "بانتظار الدفع",
  cancelledPayment: "الطلب ملغى", unknown: "الحالة غير متاحة", continuePayment: "متابعة الدفع", cancel: "إلغاء الطلب",
  confirm: "تأكيد الاستلام", close: "رجوع", cancelHint: "سيُلغى طلبك غير المدفوع. يمكنك تقديم طلب جديد لاحقاً.",
  confirmHint: "أكد الاستلام بعد استلام جميع العناصر وفحصها. سيُسجّل الطلب على أنه تم تسليمه.",
  working: "يرجى الانتظار…", updated: "تم تحديث الطلب.", actionError: "تعذر إكمال الإجراء. حدّث الطلب وحاول مجدداً.",
  error: "تعذر تحميل الطلب.", unavailable: "هذا الطلب غير متاح أو لا تملك صلاحية عرضه.", retry: "حاول مجدداً",
  refresh: "تحديث", refreshing: "جارٍ التحديث…", refreshError: "تعذر التحديث. تظهر آخر تفاصيل تم تحميلها.",
  loading: "جارٍ تحميل طلبك", copy: "نسخ", copied: "تم النسخ", copyError: "تعذر النسخ. حدد النص وانسخه يدوياً.",
  chat: "محادثة البائع", chatHint: "ابدأ محادثة حول هذا الطلب أو تابع رسائلك السابقة.",
  chatLoading: "جارٍ التحقق من توفر المحادثة…", chatConfigError: "تعذر تحميل المحادثة. حاول مجدداً.", chatDisabled: "المحادثة معطلة حالياً.", chatSellerUnavailable: "لم يفعّل هذا البائع المحادثة بعد.", chatError: "تعذر فتح المحادثة. حاول مجدداً.",
  delivery: "تفاصيل الشحن", recipient: "المستلم", address: "العنوان", postal: "الرمز البريدي", carrier: "شركة الشحن", tracking: "رقم التتبع", shipped: "تاريخ الشحن",
  shippingWait: "ستظهر تفاصيل الشحنة هنا بعد إرسال الطلب.", download: "تنزيل الملف", downloadHint: "يفتح في علامة تبويب جديدة",
  remaining: "التنزيلات المتبقية", unlimited: "تنزيلات غير محدودة", exhausted: "تم بلوغ حد التنزيل", locked: "التنزيل غير متاح",
  downloadWait: "سيظهر رابط التنزيل هنا عندما يصبح متاحاً.", inputs: "المعلومات المرسلة", protected: "محمية بعد الإرسال",
  note: "ملاحظة الخدمة", result: "نتيجة الخدمة", structured: "عرض النتيجة الكاملة", completed: "تاريخ الإكمال", resultWait: "ستظهر النتيجة هنا عند اكتمال الخدمة.",
  refund: "طلب استرداد", reason: "سبب الطلب", reasonHint: "اشرح المشكلة في ٣ إلى ٥٠٠ حرف.", send: "إرسال الطلب",
  refundSent: "تم إرسال طلب الاسترداد للمراجعة.", refundValidation: "أدخل سبباً بين ٣ و٥٠٠ حرف.",
  empty: "عناصر هذا الطلب غير متاحة.", latest: "آخر تحديث", live: "تحديث تلقائي",
  steps: { placed: "تقديم الطلب", payment: "الدفع", processing: "قيد التنفيذ", shipped: "تم الشحن", ready: "جاهز للاستلام", delivered: "تم التسليم" },
  types: { digital: "ملف رقمي", service: "خدمة", bridge: "خدمة إلكترونية", physical: "منتج مادي" },
  statuses: { pending: "بانتظار الدفع", paid: "مدفوع", processing: "قيد التنفيذ", shipped: "تم الشحن", awaiting_confirmation: "بانتظار تأكيدك", delivered: "تم التسليم", cancelled: "ملغى", refunded: "تم الاسترداد", waiting_payment: "بانتظار الدفع", queued: "في الانتظار", submitting: "جارٍ الإرسال", submitted: "تم الإرسال", polling: "جارٍ فحص النتيجة", manual_required: "بحاجة إلى مراجعة", succeeded: "مكتمل", failed: "لم تنجح الخدمة", refund_requested: "الاسترداد قيد المراجعة" },
  hints: { pending: "أكمل الدفع لبدء طلبك.", paid: "تم استلام الدفع. راجع تفاصيل التسليم أدناه.", processing: "يعمل البائع على طلبك. ستظهر المستجدات هنا.", shipped: "طلبك في الطريق. راجع تفاصيل الشحنة أدناه.", awaiting_confirmation: "افحص طلبك ثم أكد استلامه.", delivered: "اكتمل طلبك. تفاصيل الشراء متاحة أدناه.", cancelled: "تم إلغاء هذا الطلب.", refunded: "تم استرداد مبلغ هذا الطلب.", failed: "تحتاج خدمة أو أكثر إلى المتابعة. راجع العنصر المعني أدناه.", refund_requested: "طلب الاسترداد قيد المراجعة. لم يتم رد المبلغ بعد.", manual_required: "تحتاج خدمتك إلى مراجعة. راجع الإجراءات المتاحة أدناه." },
};
export const ORDER_COPY: Record<Locale, OrderCopy> = { en, fa, ar };
export function statusLabel(c: OrderCopy, status: string) { return c.statuses[status as keyof OrderCopy["statuses"]] ?? c.unknown; }
export function statusTone(status: string) {
  if (["delivered", "succeeded", "paid"].includes(status)) return "success";
  if (["failed", "cancelled"].includes(status)) return "error";
  if (["processing", "shipped", "awaiting_confirmation", "polling", "submitted", "submitting"].includes(status)) return "info";
  return "neutral";
}
