"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 relative w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-3 sm:space-x-4 sm:space-y-0",
        month: "space-y-3 w-full",
        month_caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-sm font-bold",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-10 bg-white p-0 opacity-90 hover:opacity-100 absolute left-0 top-[55%] -translate-y-1/2 rounded-full shadow-md z-10 border border-neutral-200 text-black hover:bg-neutral-50"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-10 bg-white p-0 opacity-90 hover:opacity-100 absolute right-0 top-[55%] -translate-y-1/2 rounded-full shadow-md z-10 border border-neutral-200 text-black hover:bg-neutral-50"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between w-full px-4 sm:px-6",
        weekday: "text-neutral-600 rounded-md w-9 font-medium text-xs",
        week: "flex justify-between w-full mt-2 px-4 sm:px-6",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-neutral-100 [&:has([aria-selected].outside)]:bg-neutral-100/50 [&:has([aria-selected].range_end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.range_end)]:rounded-r-md [&:has(>.range_start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-medium aria-selected:opacity-100 text-sm"
        ),
        range_start: "range_start",
        range_end: "range_end",
        selected: "bg-black text-white hover:bg-black hover:text-white focus:bg-black focus:text-white",
        today: "bg-neutral-100 text-neutral-900",
        outside: "outside text-neutral-500 aria-selected:bg-neutral-100/50 aria-selected:text-neutral-600",
        disabled: "text-neutral-300 opacity-50 cursor-not-allowed hover:bg-transparent bg-neutral-50/50 line-through decoration-red-400 decoration-2",
        range_middle: "aria-selected:bg-neutral-100 aria-selected:text-neutral-900",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
