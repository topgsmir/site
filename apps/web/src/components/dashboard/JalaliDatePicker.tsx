"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./JalaliDatePicker.module.css";

type Props = {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  dateTime?: boolean;
  label?: string;
};

const calendar = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric" });
const monthTitle = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" });
const fullDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });
const dayNumber = new Intl.NumberFormat("fa-IR");
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const text = {
  en: { choose: "Choose Jalali date", previous: "Previous month", next: "Next month", clear: "Clear date", time: "Time" },
  fa: { choose: "انتخاب تاریخ شمسی", previous: "ماه قبل", next: "ماه بعد", clear: "پاک کردن تاریخ", time: "زمان" },
  ar: { choose: "اختر التاريخ الهجري الشمسي", previous: "الشهر السابق", next: "الشهر التالي", clear: "مسح التاريخ", time: "الوقت" }
} as const;

function localDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}

function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function jalaliDay(date: Date) {
  const parts = calendar.formatToParts(date);
  return Number(parts.find((part) => part.type === "day")?.value);
}

function monthStart(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - jalaliDay(start) + 1);
  return start;
}

function moveMonth(date: Date, direction: number) {
  const next = new Date(monthStart(date));
  next.setDate(next.getDate() + (direction > 0 ? 35 : -1));
  return monthStart(next);
}

export function JalaliDatePicker({ locale, value, onChange, min, max, dateTime = false, label }: Props) {
  const selected = localDate(value);
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => monthStart(selected ?? new Date()));
  const root = useRef<HTMLDivElement>(null);
  const c = text[locale];

  useEffect(() => {
    if (!visible) return;
    function close(event: MouseEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setVisible(false);
    }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setVisible(false); }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [visible]);

  const start = monthStart(month);
  const end = moveMonth(start, 1);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const offset = (start.getDay() + 1) % 7;
  const time = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(value)?.[1] ?? "00:00";
  const display = selected ? `${fullDate.format(selected)}${dateTime ? ` · ${time}` : ""}` : c.choose;

  return <div className={styles.root} ref={root}>
    <button className={styles.trigger} type="button" aria-label={label ? `${label}: ${display}` : undefined} aria-haspopup="dialog" aria-expanded={visible} onClick={() => { setMonth(monthStart(selected ?? new Date())); setVisible((current) => !current); }}>
      <span dir="ltr">{display}</span><span aria-hidden="true">▾</span>
    </button>
    {visible ? <div className={styles.popover} role="dialog" aria-label={c.choose} dir="rtl">
      <div className={styles.header}>
        <button type="button" aria-label={c.previous} onClick={() => setMonth(moveMonth(month, -1))}>›</button>
        <strong>{monthTitle.format(start)}</strong>
        <button type="button" aria-label={c.next} onClick={() => setMonth(moveMonth(month, 1))}>‹</button>
      </div>
      <div className={styles.grid}>
        {weekDays.map((day, index) => <span className={styles.weekDay} key={index}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          const iso = isoDay(date);
          return <button type="button" key={iso} aria-label={fullDate.format(date)} disabled={Boolean((min && iso < min.slice(0, 10)) || (max && iso > max.slice(0, 10)))} aria-pressed={iso === value.slice(0, 10)} onClick={() => { onChange(dateTime ? `${iso}T${time}` : iso); setVisible(false); }}>{dayNumber.format(index + 1)}</button>;
        })}
      </div>
      <button className={styles.clear} type="button" onClick={() => { onChange(""); setVisible(false); }}>{c.clear}</button>
    </div> : null}
    {dateTime ? <input className={styles.time} type="time" aria-label={c.time} disabled={!selected} value={time} onChange={(event) => onChange(`${value.slice(0, 10)}T${event.target.value}`)} /> : null}
  </div>;
}
