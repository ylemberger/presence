import { cn } from "@/lib/cn";

const ICONS: Record<string, string> = {
  add: "M12 5v14M5 12h14",
  add_box: "M4 4h16v16H4zM12 8v8M8 12h8",
  add_circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8",
  account_circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6.5 18.2c1.5-2 3.4-3.2 5.5-3.2s4 1.2 5.5 3.2",
  arrow_back: "M15 6l-6 6 6 6M9 12h10",
  assessment: "M5 20V10M10 20V4M15 20v-8M20 20V8",
  auto_awesome_mosaic: "M4 4h7v7H4zM13 4h7v16h-7zM4 13h7v7H4z",
  badge: "M7 8h10M7 12h10M7 16h6M5 4h14v16H5z",
  bar_chart: "M5 20V10M12 20V4M19 20v-7",
  calendar_month: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  calendar_today: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  calendar_view_week: "M4 5h16v14H4zM9 5v14M15 5v14",
  cancel: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5 9-9",
  check_circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6",
  chevron_left: "M14 6l-6 6 6 6",
  chevron_right: "M10 6l6 6-6 6",
  circle: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
  class: "M4 5h16v14H4zM8 9h8M8 13h6",
  close: "M6 6l12 12M18 6L6 18",
  contact_phone: "M6 4h8l4 4v12H6zM8 16h4M7 8h6",
  content_copy: "M8 8h12v12H8zM4 4h12v4",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  date_range: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2",
  done_all: "M2 12l4 4 8-8M10 16l2 2 10-10",
  donut_large: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  edit: "M4 20h4l10-10-4-4L4 16v4zM14 6l4 4",
  edit_note: "M4 6h10M4 12h8M4 18h6M14 14l6 6",
  error: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.5",
  event_available: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
  event_busy: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 14l6 6M15 14l-6 6",
  event_repeat: "M4 8h12l-3-3M20 16H8l3 3",
  expand_more: "M6 9l6 6 6-6",
  fact_check: "M4 5h16v14H4zM8 10l2 2 4-4",
  filter_alt: "M4 6h16l-6 7v5l-4-2v-3z",
  filter_list: "M4 7h16M7 12h10M10 17h4",
  group: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.5-5 5-5s5 2 5 5M13 19c.3-2.5 2-4 5-4s5 1.8 5 4",
  groups: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.5-5 5-5s5 2 5 5M13 19c.3-2.5 2-4 5-4s5 1.8 5 4",
  block: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 8l8 8M16 8l-8 8",
  touch_app: "M9 11V5a2 2 0 1 1 4 0v8l4-2a2 2 0 0 1 2 3l-6 7H8V11zM5 11v10",
  group_add: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.5-5 5-5s5 2 5 5M16 8v6M13 11h6",
  group_off: "M4 4l16 16M8 10a3 3 0 1 0 0-6M3 19c0-3 2.5-5 5-5",
  history: "M12 7v5l3 2M4.5 12a7.5 7.5 0 1 0 2-5.2L4 9",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 10v6M12 7v.5",
  insights: "M4 19h16M7 16V9M12 16V5M17 16v-4",
  list_alt: "M4 6h16M4 12h16M4 18h16M4 6v12",
  lock: "M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z",
  logout: "M10 5H5v14h5M10 12h10M16 8l4 4-4 4",
  manage_history: "M12 7v5l3 2M4.5 12a7.5 7.5 0 1 0 2-5.2",
  meeting_room: "M6 4h9v16H6zM15 8h3v12h-3M9 12h2",
  menu_book: "M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3V5zM20 5h-7a3 3 0 0 0-3 3v11h7a3 3 0 0 1 3 3V5z",
  move_up: "M12 19V7M7 12l5-5 5 5",
  notification_important: "M12 4a6 6 0 0 1 6 6v4l2 2H4l2-2v-4a6 6 0 0 1 6-6zM10 19a2 2 0 0 0 4 0M12 9v3M12 14v.5",
  notifications: "M12 4a6 6 0 0 1 6 6v4l2 2H4l2-2v-4a6 6 0 0 1 6-6zM10 19a2 2 0 0 0 4 0",
  open_in_new: "M10 6H5v13h13v-5M12 4h8v8M11 13l9-9",
  pending: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  pending_actions: "M4 5h10v14H4zM16 10l4 2-4 2M8 10h4M8 14h3",
  person_4: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.5 3-6 7-6s7 2.5 7 6",
  person_add: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.5 3-6 7-6M17 14v6M14 17h6",
  person_off: "M4 4l16 16M12 11a3.5 3.5 0 1 0-3.2-4.8M5 20c0-3.5 3-6 7-6",
  person_remove: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.5 3-6 7-6M16 16h6",
  playlist_add: "M4 7h12M4 12h8M4 17h8M15 14v6M12 17h6",
  post_add: "M5 4h10l4 4v12H5zM9 13h6M12 10v6",
  print: "M6 9V4h12v5M6 14H4v6h16v-6h-2M8 17h8",
  report: "M12 3l9 16H3L12 3zM12 10v4M12 16v.5",
  restore: "M4 12a8 8 0 1 0 2.4-5.7L4 9M12 8v5l3 2",
  route: "M6 6h4v4H6zM14 14h4v4h-4zM10 8h4l2 6",
  rule: "M5 7h14M5 12h10M5 17h14M16 11l2 2 4-4",
  save: "M5 4h11l3 3v13H5zM8 4v5h8M8 16h8",
  schedule: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2",
  school: "M3 10l9-5 9 5-9 5-9-5zM7 12v5l5 3 5-3v-5",
  search: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM16 16l4 4",
  search_off: "M4 4l16 16M11 5a6 6 0 0 1 5.7 4.3M16 16l4 4",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M6.5 6.5l1.5 1.5M16 16l1.5 1.5M6.5 17.5L8 16M16 8l1.5-1.5",
  stairs: "M4 20h4v-4h4v-4h4V8h4",
  table_view: "M4 5h16v14H4zM4 10h16M10 10v9",
  task_alt: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6",
  trending_up: "M4 16l6-6 4 4 6-7M14 7h6v6",
  tune: "M5 8h8M16 8h3M12 16h7M5 16h4M13 5v6M9 13v6",
  verified_user: "M12 3l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7l8-4zM9 12l2 2 4-4",
  view_agenda: "M4 5h16v6H4zM4 13h16v6H4z",
  warning: "M12 4l9 16H3L12 4zM12 10v4M12 16v.5",
  workspace_premium: "M12 3l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z",
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const d = ICONS[name] ?? ICONS.circle;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-[1em] w-[1em] shrink-0 align-middle", className)}
    >
      <path d={d} />
    </svg>
  );
}
