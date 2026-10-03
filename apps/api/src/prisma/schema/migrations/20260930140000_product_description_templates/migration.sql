CREATE TABLE "product_description_templates" (
    "id" UUID NOT NULL,
    "locale" "blog_locale" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_description_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_description_templates_name_check" CHECK (length(trim("name")) BETWEEN 1 AND 100),
    CONSTRAINT "product_description_templates_content_check" CHECK (length(trim("content")) BETWEEN 1 AND 10000)
);

CREATE INDEX "product_description_templates_locale_active_name_id_idx" ON "product_description_templates"("locale", "active", "name", "id");
CREATE INDEX "product_description_templates_created_by_id_idx" ON "product_description_templates"("created_by_id");
CREATE INDEX "product_description_templates_updated_by_id_idx" ON "product_description_templates"("updated_by_id");

ALTER TABLE "product_description_templates" ADD CONSTRAINT "product_description_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_description_templates" ADD CONSTRAINT "product_description_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move the three existing hardcoded description choices into editable records for each language.
INSERT INTO "product_description_templates" ("id", "locale", "name", "content") VALUES
('00000000-0000-4000-8000-000000000101', 'fa', 'معرفی محصول', $template${title}

معرفی
کاربرد محصول و مخاطب مناسب آن را توضیح دهید.

ویژگی‌های اصلی
ویژگی‌ها و مزایای تأییدشده را بنویسید.

محتویات
اقلام یا دسترسی‌های همراه محصول را فهرست کنید.$template$),
('00000000-0000-4000-8000-000000000102', 'fa', 'مشخصات فنی', $template${title}

سازگاری
مدل‌ها و پیش‌نیازهای پشتیبانی‌شده را بنویسید.

مشخصات فنی
مشخصات فنی تأییدشده را وارد کنید.

نکات استفاده
روش راه‌اندازی، نگهداری و محدودیت‌ها را توضیح دهید.$template$),
('00000000-0000-4000-8000-000000000103', 'fa', 'خدمات', $template${title}

معرفی خدمت
خدمت و نتیجهٔ مورد انتظار را توضیح دهید.

مراحل انجام
مراحل و زمان تقریبی را بنویسید.

پیش‌نیازها
مواردی را که مشتری باید آماده کند فهرست کنید.$template$),
('00000000-0000-4000-8000-000000000104', 'en', 'Overview', $template${title}

Overview
Describe what this product is and who it is for.

Key features
Add the verified features and benefits.

What is included
List the items or access included with the product.$template$),
('00000000-0000-4000-8000-000000000105', 'en', 'Technical details', $template${title}

Compatibility
List supported models and requirements.

Specifications
Add verified technical specifications.

Usage notes
Explain setup, care, and any limitations.$template$),
('00000000-0000-4000-8000-000000000106', 'en', 'Service', $template${title}

Service overview
Explain the service and its intended outcome.

Process
Describe the steps and expected timing.

Requirements
List what the customer should prepare.$template$),
('00000000-0000-4000-8000-000000000107', 'ar', 'نظرة عامة', $template${title}

نظرة عامة
اشرح استخدام المنتج والفئة المناسبة له.

الميزات الرئيسية
أضف الميزات والفوائد المؤكدة.

المحتويات
اذكر العناصر أو الصلاحيات المضمنة.$template$),
('00000000-0000-4000-8000-000000000108', 'ar', 'المواصفات الفنية', $template${title}

التوافق
اذكر الأجهزة والمتطلبات المدعومة.

المواصفات الفنية
أضف المواصفات الفنية المؤكدة.

ملاحظات الاستخدام
اشرح الإعداد والعناية والقيود.$template$),
('00000000-0000-4000-8000-000000000109', 'ar', 'الخدمة', $template${title}

نظرة عامة على الخدمة
اشرح الخدمة والنتيجة المتوقعة.

الخطوات
صف الخطوات والوقت المتوقع.

المتطلبات
اذكر ما ينبغي على العميل تحضيره.$template$);
