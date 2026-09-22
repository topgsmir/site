"use client";
import { useParams } from "next/navigation";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useParams<{ locale: string }>();
  const copy = locale === "fa" ? { title: "صفحه بارگذاری نشد", text: "ارتباط موقتاً برقرار نیست. دوباره تلاش کنید.", retry: "تلاش دوباره" } : locale === "ar" ? { title: "تعذر تحميل الصفحة", text: "الاتصال غير متاح مؤقتاً. حاول مرة أخرى.", retry: "حاول مرة أخرى" } : { title: "The page could not be loaded", text: "The service is temporarily unavailable. Please try again.", retry: "Try again" };
  return <main style={{ maxWidth: 640, margin: "80px auto", padding: 24 }}><h1>{copy.title}</h1><p>{copy.text}</p><button style={{ minHeight: 44, padding: "10px 20px" }} onClick={reset}>{copy.retry}</button></main>;
}
