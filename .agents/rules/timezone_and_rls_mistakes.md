# Important Lessons Learned: Timezone and Supabase RLS

1. **Javascript Timezone Bug (`.toISOString()`)**
   - NEVER use `date.toISOString().split("T")[0]` to format a date selected from a Calendar component in Javascript unless you intend to convert it to UTC time.
   - For a user in UTC+8 (e.g., Philippines), selecting "Sept 29" in a calendar creates a local Date object of `Sept 29 00:00:00`. Calling `.toISOString()` subtracts 8 hours, resulting in `Sept 28 16:00:00 UTC`, which splits to `"2026-09-28"`. This causes bookings to shift back by one day!
   - **SOLUTION**: Always write a `formatLocalDate` function to manually extract `.getFullYear()`, `.getMonth()`, and `.getDate()` to preserve the local time exactly.

2. **Supabase Row-Level Security (RLS) and UI Visibility**
   - When building features that require users to see public states of resources (e.g., a calendar showing which dates are already booked), do NOT query the `bookings` table directly from the client if RLS is enabled.
   - RLS policies typically restrict users to reading only their *own* bookings. Thus, a query from Tourist B will return an empty array for Tourist A's bookings, failing to show the dates as "blocked/disabled".
   - **SOLUTION**: Use Next.js Server Actions with a Supabase Admin Client (Service Role Key) to fetch public, non-sensitive booking dates, completely bypassing RLS for safe UI updates.
