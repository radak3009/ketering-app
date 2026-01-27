import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface KitchenStatus {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  currentTime: string;
  reason: "open" | "exception_closed" | "weekly_closed" | "outside_hours";
}

/**
 * Check if kitchen is currently open based on schedule and exceptions.
 * All time calculations are done in Europe/Belgrade timezone.
 */
export async function isKitchenOpen(
  supabase: SupabaseClient,
  companyId: string | null = null
): Promise<KitchenStatus> {
  // Get current time in Europe/Belgrade timezone
  const now = new Date();
  
  // Format date parts in Belgrade timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const dateStr = formatter.format(now); // YYYY-MM-DD
  const timeStr = timeFormatter.format(now); // HH:mm:ss
  const currentTimeDisplay = timeStr.substring(0, 5); // HH:mm
  
  // Get day of week in Belgrade timezone (0=Sunday, 6=Saturday)
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Belgrade",
    weekday: "short",
  });
  const weekdayStr = weekdayFormatter.format(now);
  const dayOfWeekMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayOfWeekMap[weekdayStr] ?? 0;

  // 1. Check for exceptions on today's date
  let exceptionQuery = supabase
    .from("kitchen_schedule_exceptions")
    .select("closed_all_day, open_time, close_time, note")
    .eq("exception_date", dateStr);

  if (companyId) {
    exceptionQuery = exceptionQuery.eq("company_id", companyId);
  } else {
    exceptionQuery = exceptionQuery.is("company_id", null);
  }

  const { data: exception, error: exceptionError } = await exceptionQuery.maybeSingle();

  if (exceptionError) {
    console.error("Error fetching exception:", exceptionError);
  }

  if (exception) {
    if (exception.closed_all_day) {
      return {
        isOpen: false,
        openTime: null,
        closeTime: null,
        currentTime: currentTimeDisplay,
        reason: "exception_closed",
      };
    }

    // Exception has custom hours
    const openTime = exception.open_time?.substring(0, 5) || null;
    const closeTime = exception.close_time?.substring(0, 5) || null;

    if (openTime && closeTime) {
      const isInRange = timeStr >= exception.open_time && timeStr < exception.close_time;
      return {
        isOpen: isInRange,
        openTime,
        closeTime,
        currentTime: currentTimeDisplay,
        reason: isInRange ? "open" : "outside_hours",
      };
    }
  }

  // 2. Check weekly schedule
  let scheduleQuery = supabase
    .from("kitchen_schedule_weekly")
    .select("enabled, open_time, close_time")
    .eq("day_of_week", dayOfWeek);

  if (companyId) {
    scheduleQuery = scheduleQuery.eq("company_id", companyId);
  } else {
    scheduleQuery = scheduleQuery.is("company_id", null);
  }

  const { data: schedule, error: scheduleError } = await scheduleQuery.maybeSingle();

  if (scheduleError) {
    console.error("Error fetching schedule:", scheduleError);
  }

  if (!schedule || !schedule.enabled) {
    return {
      isOpen: false,
      openTime: null,
      closeTime: null,
      currentTime: currentTimeDisplay,
      reason: "weekly_closed",
    };
  }

  const openTime = schedule.open_time?.substring(0, 5) || null;
  const closeTime = schedule.close_time?.substring(0, 5) || null;

  const isInRange = timeStr >= schedule.open_time && timeStr < schedule.close_time;

  return {
    isOpen: isInRange,
    openTime,
    closeTime,
    currentTime: currentTimeDisplay,
    reason: isInRange ? "open" : "outside_hours",
  };
}
