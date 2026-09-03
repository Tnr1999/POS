"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

function toDateInputValue(date: Date) {
  return date.toLocaleDateString("en-CA");
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function ReportsFilterBar({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function goTo(fromDate: string, toDate: string) {
    router.push(`/reports?from=${fromDate}&to=${toDate}`);
  }

  const today = toDateInputValue(new Date());
  const isToday = from === today && to === today;
  const is7Days = from === toDateInputValue(daysAgo(6)) && to === today;
  const is30Days = from === toDateInputValue(daysAgo(29)) && to === today;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={isToday ? "primary" : "ghost"}
          onClick={() => goTo(today, today)}
        >
          วันนี้
        </Button>
        <Button
          type="button"
          size="sm"
          variant={is7Days ? "primary" : "ghost"}
          onClick={() => goTo(toDateInputValue(daysAgo(6)), today)}
        >
          7 วัน
        </Button>
        <Button
          type="button"
          size="sm"
          variant={is30Days ? "primary" : "ghost"}
          onClick={() => goTo(toDateInputValue(daysAgo(29)), today)}
        >
          30 วัน
        </Button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goTo(fromValue, toValue);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-from">
            จากวันที่
          </label>
          <Input
            id="report-from"
            type="date"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="report-to">
            ถึงวันที่
          </label>
          <Input id="report-to" type="date" value={toValue} onChange={(e) => setToValue(e.target.value)} />
        </div>
        <Button type="submit" variant="accent">
          ดูรายงาน
        </Button>
      </form>
    </div>
  );
}
