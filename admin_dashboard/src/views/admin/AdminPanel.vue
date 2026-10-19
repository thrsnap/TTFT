<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { adminApi as api, fileUrl, externalUrl } from "../../api/adminApi.js";
import CourseAdmin from "./CourseAdmin.vue";
import DailySignalAdmin from "./DailySignalAdmin.vue";
import SignalHistoryAdmin from "./SignalHistoryAdmin.vue";
import {
  getAnalysisRecords,
  createAnalysisPost,
  createAnalysisDocument,
  updateAnalysisPost,
  updateAnalysisDocument,
  deleteAnalysisRecord,
} from "../../api/analysisApi.js";
import {
  getNewsRecords,
  saveCalendarEvent,
  saveNewsSignal,
  deleteNewsRecord,
} from "../../api/newApi.js";
import {
  LayoutDashboard,
  Newspaper,
  GraduationCap,
  ChartNoAxesCombined,
  Users,
  MessagesSquare,
  Settings,
  Sun,
  Moon,
  Search,
  Plus,
  ChevronDown,
  ArrowUpRight,
  CalendarDays,
  X,
  Menu,
  ChevronRight,
  Upload,
  FileText,
  Play,
  Trash2,
  Pencil,
  CircleHelp,
  ShieldCheck,
  Bell,
  Check,
  Download,
  Send,
  LogOut,
  UserRound,
  TrendingUp,
  Activity,
} from "lucide-vue-next";

const userSignalModal = ref(null);
const userSignalsLoading = ref(false);
const userSignalSaving = ref(false);
const userSignalError = ref("");
let userSignalRequestVersion = 0;
const signalApiBase = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).trim().replace(/\/+$/, "");

async function signalAccessRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CMM-Request", "1");
  }
  const response = await fetch(`${signalApiBase}/api/signals${path}`, {
    ...options, method, headers, credentials: "include", cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
  if (!data) throw new Error("The backend did not return JSON.");
  return data;
}

async function openUserSignalAccess(user) {
  if (saving.value || userSignalSaving.value) return;
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) {
    notify("This member needs the email used by their registered website account.");
    return;
  }
  userSignalRequestVersion++;
  userSignalModal.value = { name: user.name || user.username || email, email };
  userSignalError.value = "";
  userSignalsLoading.value = false;
}

function closeUserSignalAccess() {
  if (userSignalSaving.value) return;
  userSignalRequestVersion++;
  userSignalModal.value = null;
  userSignalsLoading.value = false;
}

async function approveUserSignalAccess() {
  if (!userSignalModal.value || userSignalSaving.value || userSignalsLoading.value) return;
  userSignalSaving.value = true;
  userSignalError.value = "";
  try {
    const result = await signalAccessRequest("/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userSignalModal.value.email }),
    });
    userSignalModal.value = null;
    notify(result.message || "All News Signals are unlocked for one month.");
  } catch (e) {
    userSignalError.value = e.message || "Could not approve access.";
  } finally {
    userSignalSaving.value = false;
  }
}

const paidPayments = ref([]);
const paidSummary = ref(null);
const paidPagination = ref({ page: 1, totalPages: 0, total: 0 });
const paidLoading = ref(false);
const paidError = ref("");
let paidRequestController;
const paymentsAdminApiPath = (
  import.meta.env.VITE_ADMIN_API_PATH || "/api/admin"
).trim().replace(/\/+$/, "");
const paymentStatusFilter = ref("paid");
const paymentUserIdFilter = ref("");
const paymentProductFilter = ref("all");

const paidCards = computed(() => [
  { label: "Total paid users", value: paidSummary.value?.totalPaidUsers },
  { label: "Course buyers", value: paidSummary.value?.courseBuyers },
  { label: "News signal buyers", value: paidSummary.value?.signalBuyers },
  { label: "Daily signal buyers", value: paidSummary.value?.dailySignalBuyers },
  { label: "Successful payments", value: paidSummary.value?.successfulPayments },
  {
    label: "Total collected (USD)",
    value: paidSummary.value ? money(paidSummary.value.totalAmount) : undefined,
  },
]);

async function fetchPaidPayments(requestedPage = 1) {
  paidRequestController?.abort();
  const controller = new AbortController();
  paidRequestController = controller;
  paidLoading.value = true;
  paidError.value = "";
  try {
    const userId = paymentUserIdFilter.value.trim();
    if (userId && !/^[a-f0-9]{24}$/i.test(userId)) {
      throw new Error("Enter a valid 24-character user ID.");
    }
    const query = new URLSearchParams({
      page: String(requestedPage),
      status: paymentStatusFilter.value,
      productType: paymentProductFilter.value,
    });
    if (userId) query.set("userId", userId);
    const response = await fetch(
      `${signalApiBase}${paymentsAdminApiPath}/payments?${query}`,
      {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `Unable to load payments (${response.status})`);
    }
    if (!data?.success || !Array.isArray(data.payments) || !data.summary || !data.pagination) {
      throw new Error("Invalid paid payments response.");
    }
    const summaryFields = ["totalPaidUsers", "courseBuyers", "signalBuyers", "dailySignalBuyers", "successfulPayments"];
    if (summaryFields.some(field => !Number.isInteger(data.summary[field]) || data.summary[field] < 0)
      || !Number.isFinite(Number(data.summary.totalAmount))
      || !Number.isInteger(data.pagination.page) || data.pagination.page < 1
      || !Number.isInteger(data.pagination.totalPages) || data.pagination.totalPages < 0) {
      throw new Error("Invalid payment totals or pagination.");
    }
    if (controller.signal.aborted) return;
    paidPayments.value = data.payments;
    paidSummary.value = data.summary;
    paidPagination.value = data.pagination;
  } catch (e) {
    if (!controller.signal.aborted) paidError.value = e.message || "Unable to load payments.";
  } finally {
    if (paidRequestController === controller) paidLoading.value = false;
  }
}

function paidProductLabel(payment) {
  if (payment.productId === 'daily-signal-monthly') return 'Daily Signals · monthly';
  if (payment.productId === 'news-signal-monthly' || payment.productId?.startsWith('signal:') || payment.productType === 'news-signal') return 'News Signals · monthly';
  if (payment.productId?.startsWith('course:') || payment.productType === 'course') return 'Course';
  return 'Other product';
}
function isMonthlySignalPayment(payment) {
  return ['news-signal', 'daily-signal'].includes(payment.productType) ||
    ['news-signal-monthly', 'daily-signal-monthly'].includes(payment.productId) || payment.productId?.startsWith('signal:');
}
function paymentPeriod(payment) {
  return payment.subscription || payment.newsSubscription || payment.dailySubscription;
}
function subscriptionAccessLabel(payment) {
  if (payment.status !== 'paid') return 'Not activated';
  const period = paymentPeriod(payment);
  if (!period) return 'Expiry unavailable';
  if (period.status === 'scheduled') return 'Starts later';
  return period.active ? 'Active' : 'Expired';
}
function subscriptionExpiryLabel(payment) {
  const expiry = paymentPeriod(payment)?.expiresAt;
  return expiry ? date(expiry) + ' ' + time(expiry) : '—';
}

watch([paymentStatusFilter, paymentUserIdFilter, paymentProductFilter], () => {
  paidRequestController?.abort();
  paidPayments.value = [];
  paidPagination.value = { page: 1, totalPages: 0, total: 0 };
  paidError.value = "Filters changed. Click Apply filters to load orders.";
}, { flush: "sync" });

onUnmounted(() => paidRequestController?.abort());

const signalImage = ref(null);
const analysisImages = ref([]);
const replaceAnalysisImages = ref(false);
const documentFile = ref(null);
const router = useRouter();
const route = useRoute();
const nav = [
  ["Dashboard", LayoutDashboard],
  ["News", Newspaper],
  ["Academy", GraduationCap],
  ["Analysis", ChartNoAxesCombined],
  ["Users", Users],
  ["Support", MessagesSquare],
  ["Settings", Settings],
];
const page = computed(() => route.meta.section || "Dashboard"),
  dark = ref(localStorage.getItem("admin-theme") === "dark"),
  mobile = ref(false),
  records = ref([]),
  loading = ref(true),
  error = ref(""),
  toast = ref(""),
  search = ref(""),
  tab = ref("Calendar"),
  modal = ref(null),
  draft = ref({}),
  saving = ref(false),
  profileMenu = ref(false),
  identity = ref({}),
  selectedTicket = ref(null),
  reply = ref(""),
  filter = ref("All"),
  deleteTarget = ref(null);
const dashboardStats = ref(null);
const dashboardLoading = ref(false);
const dashboardError = ref("");
const recordsLoaded = ref(false);
const list = (kind) => records.value.filter((x) => x.kind === kind);
const profile = computed(
  () =>
    list("profile")[0] || {
      name: identity.value.name || "Administrator",
      email: identity.value.email,
      role: "Administrator",
    },
);
const initials = (name) =>
  (name || "Admin")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const sectionPaths = {
  Dashboard: "/admin",
  News: "/admin/news",
  Academy: "/admin/academy",
  Analysis: "/admin/analysis",
  Users: "/admin/users",
  Support: "/admin/support",
  Settings: "/admin/settings",
};
const navigate = (section) => router.push(sectionPaths[section] || "/admin");
watch(
  () => route.path,
  () => {
    search.value = "";
    filter.value = "All";
    mobile.value = false;
    profileMenu.value = false;
  },
);
function setTheme(value) {
  dark.value = value;
  localStorage.setItem("admin-theme", value ? "dark" : "light");
}
function toggleTheme() {
  setTheme(!dark.value);
}
async function fetchDashboard() {
  void fetchPaidPayments(1);
  dashboardLoading.value = true;
  dashboardError.value = "";
  try {
    const data = await api("dashboard");
    for (const field of ["totalUsers", "newUsers", "activeUsers"]) {
      if (!Number.isInteger(data?.[field]) || data[field] < 0) {
        throw new Error(
          "Invalid dashboard response: expected " +
            field +
            " to be a non-negative integer.",
        );
      }
    }
    dashboardStats.value = data;
  } catch (e) {
    dashboardError.value = e.message || "Could not load dashboard information.";
  } finally {
    dashboardLoading.value = false;
  }
}
async function loadRecords() {
  loading.value = true;
  error.value = "";
  recordsLoaded.value = false;
  try {
    let data;
    if (page.value === "Academy") {
      records.value = [];
      recordsLoaded.value = true;
      return;
    } else if (page.value === "Analysis") data = await getAnalysisRecords();
    else if (page.value === "News") data = await getNewsRecords();
    else data = await api("data");
    if (!Array.isArray(data))
      throw new Error("The endpoint must return an array of records.");
    records.value = data;
    recordsLoaded.value = true;
  } catch (errorCaught) {
    error.value = errorCaught.message || "Could not load records.";
  } finally {
    loading.value = false;
  }
}
async function load() {
  error.value = "";
  try {
    identity.value = await api("identity");
  } catch (e) {
    error.value = e.message;
    loading.value = false;
    return;
  }
  if (page.value === "Dashboard") {
    loading.value = false;
    await fetchDashboard();
  } else await loadRecords();
}
watch(page, async (section) => {
  error.value = "";
  if (section === "Dashboard") await fetchDashboard();
  else await loadRecords();
});
const statCards = computed(() => [
  {
    label: "Total users",
    value: dashboardStats.value?.totalUsers,
    icon: Users,
    note: "All registered accounts",
    color: "mint",
  },
  {
    label: "New users",
    value: dashboardStats.value?.newUsers,
    icon: UserRound,
    note: "Registered in the last 30 days",
    color: "blue",
  },
  {
    label: "Active users",
    value: dashboardStats.value?.activeUsers,
    icon: Activity,
    note: "Active in the last 15 minutes",
    color: "purple",
  },
]);
function notify(text) {
  toast.value = text;
  setTimeout(() => (toast.value = ""), 4500);
}
const currentKind = computed(
  () =>
    ({
      News: tab.value === "Calendar" ? "events" : "signals",
      Academy: "courses",
      Analysis: "analysis",
      Users: "users",
    })[page.value],
);

// Calendar days use the same browser-local timezone as the event form.
function localDateKey(value) {
  if (!value) return "";
  const valueDate = new Date(value);
  if (!Number.isFinite(valueDate.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${valueDate.getFullYear()}-${pad(valueDate.getMonth() + 1)}-${pad(valueDate.getDate())}`;
}
function parseCalendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  // Local noon avoids parsing YYYY-MM-DD as UTC and keeps DST day changes safe.
  const valueDate = new Date(`${value}T12:00:00`);
  return Number.isFinite(valueDate.getTime()) &&
    localDateKey(valueDate) === value
    ? valueDate
    : null;
}
const calendarDay = ref(localDateKey(new Date()));
const calendarTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isCalendar = computed(
  () => page.value === "News" && tab.value === "Calendar",
);
const calendarDayLabel = computed(() => {
  const selected = parseCalendarDay(calendarDay.value);
  return selected
    ? selected.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
});
const calendarDayEvents = computed(() =>
  list("events")
    .filter((record) => localDateKey(record.scheduledAt) === calendarDay.value)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    ),
);
function selectCalendarDay(value) {
  if (!parseCalendarDay(value)) return;
  calendarDay.value = value;
}
function changeCalendarDay(offset) {
  const selected = parseCalendarDay(calendarDay.value);
  if (!selected) return;
  selected.setDate(selected.getDate() + offset);
  calendarDay.value = localDateKey(selected);
}
function showCalendarToday() {
  calendarDay.value = localDateKey(new Date());
}
const visible = computed(() => {
  const source = isCalendar.value
    ? calendarDayEvents.value
    : list(currentKind.value);
  return source.filter(
    (r) =>
      (filter.value === "All" ||
        r.category === filter.value ||
        r.status === filter.value) &&
      [
        r.title,
        r.name,
        r.email,
        r.currency,
        r.pair,
        ...(isCalendar.value ? [r.country] : []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  );
});
const recent = computed(() =>
  records.value
    .filter((x) => !["settings", "profile"].includes(x.kind))
    .slice(0, 5),
);
const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0),
  );
const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const time = (v) =>
  v
    ? new Date(v).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const greetings =
  new Date().getHours() < 12 ? "Good morning" : "Good afternoon";
const fields = {
  events: [
    ["title", "Event title", "text", true],
    ["country", "Country", "text", true],
    [
      "currency",
      "Currency",
      "select",
      true,
      ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY"],
    ],
    [
      "scheduledAt",
      "Date & time (your local timezone)",
      "datetime-local",
      true,
    ],
    ["impact", "Impact", "select", true, ["High", "Medium", "Low", "Holiday"]],
    ["forecast", "Forecast", "text"],
    ["previous", "Previous", "text"],
    ["actual", "Actual", "text"],
    [
      "status",
      "Status",
      "select",
      true,
      ["Scheduled", "Released", "Cancelled"],
    ],
    ["sourceUrl", "Source link", "url"],
  ],
  signals: [
    ["title", "Signal title", "text", true],
    ["pair", "Trading pair", "text", true],
    [
      "scheduledAt",
      "News date and time (your local timezone)",
      "datetime-local",
      true,
    ],
    ["newsType", "News type", "text", true],
    ["direction", "Direction", "select", true, ["pending", "buy", "sell"]],
    ["confirmed", "Confirmed", "select", true, ["false", "true"]],
    ["previewText", "Public preview text", "textarea"],
    ["details", "Private signal details (optional)", "textarea", false],
    ["news", "Private news information", "textarea"],
    [
      "attachment",
      "Signal image (optional) — JPG, PNG or WebP, maximum 2 MB",
      "file",
      false,
      "image/jpeg,image/png,image/webp",
    ],
  ],
  courses: [
    ["title", "Course title", "text", true],
    ["description", "Description", "textarea", true],
    ["price", "Price (USD)", "number", true],
    ["status", "Status", "select", true, ["Draft", "Published"]],
    [
      "attachment",
      "Course video (up to 100 MB)",
      "file",
      false,
      "video/mp4,video/webm",
    ],
    ["videoUrl", "Or hosted video link", "url"],
  ],
  analysis: [
    ["title", "Analysis title", "text", true],
    [
      "category",
      "Category",
      "select",
      true,
      ["ICT", "PD Array", "CSNR", "SMS"],
    ],
    ["pair", "Trading pair", "text", true],
    ["timeframe", "Timeframe (for example H4)", "text", true],
    ["date", "Analysis date and time", "datetime-local", true],
    [
      "images",
      "Chart images (up to 10)",
      "file",
      false,
      "image/jpeg,image/png,image/webp",
    ],
    ["details", "Technical analysis", "textarea", true],
    ["status", "Status", "select", true, ["Draft", "Published"]],
  ],
  documents: [
    ["title", "Document title", "text", true],
    ["description", "Description", "textarea"],
    [
      "type",
      "Document type",
      "select",
      true,
      ["PDF", "Word Document", "ZIP", "Other"],
    ],
    [
      "file",
      "Upload document from your computer",
      "file",
      false,
      ".pdf,.doc,.docx,.zip",
    ],
    ["url", "Or hosted document URL (optional when uploading)", "url", false],
    ["status", "Status", "select", true, ["Draft", "Published"]],
  ],
  users: [
    ["name", "Full name", "text", true],
    ["email", "Email address", "email", true],
    ["role", "Role", "select", true, ["Member", "Admin"]],
    ["status", "Account access", "select", true, ["Active", "Suspended"]],
    ["notes", "Admin notes", "textarea"],
  ],
  profile: [
    ["name", "Full name", "text", true],
    ["email", "Contact email", "email", true],
    ["bio", "Bio", "textarea"],
  ],
  tickets: [
    ["name", "Sender name", "text", true],
    ["email", "Sender email", "email", true],
    ["title", "Subject", "text", true],
    ["message", "Message", "textarea", true],
  ],
  settings: [
    ["siteName", "Site name", "text", true],
    ["supportEmail", "Support email", "email"],
    [
      "timezone",
      "Calendar timezone",
      "select",
      true,
      ["Asia/Kolkata", "Asia/Phnom_Penh", "UTC"],
    ],
    [
      "defaultAccess",
      "Default signal access",
      "select",
      true,
      ["Subscribers only", "All members"],
    ],
  ],
};
function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function open(kind, record) {
  if (saving.value) return;
  if (kind === "courses") {
    modal.value = null;
    navigate("Academy");
    return;
  }
  documentFile.value = null;
  analysisImages.value = [];
  replaceAnalysisImages.value = false;
  if (["analysis", "documents"].includes(kind) && record?.pendingDelete) {
    notify("Cleanup is pending. Retry Delete before editing this record.");
    return;
  }
  signalImage.value = null;
  modal.value = kind;
  draft.value = record
    ? { ...record }
    : {
        status:
          kind === "users"
            ? "Active"
            : kind === "events"
              ? "Scheduled"
              : "Draft",
        role: "Member",
        access: "Free",
        audience: "Subscribers only",
        impact: "High",
        currency: "USD",
        category: "ICT",
        pair: "XAUUSD",
        price: 0,
        replies: [],
        siteName: "CMM-FT",
        timezone: "Asia/Phnom_Penh",
        defaultAccess: "Subscribers only",
      };
  if (kind === "documents") {
    draft.value.id = record?.id || record?._id || undefined;
    draft.value.type = record?.type || "PDF";
    draft.value.hasFile = Boolean(record?.hasFile);
    draft.value.url = record?.hasFile ? "" : record?.url || "";
    draft.value.description = record?.description || "";
    draft.value.status = record?.status === "Published" ? "Published" : "Draft";
  }
  if (kind === "analysis") {
    draft.value.id = record?.id || record?._id || undefined;
    draft.value.date = toLocalDateTimeInput(record?.date || new Date());
    draft.value.timeframe = record?.timeframe || "H4";
    draft.value.pair = record?.pair || record?.symbol || "XAUUSD";
    draft.value.category =
      record?.category === "PDArray" ? "PD Array" : record?.category || "ICT";
    draft.value.status = record?.status === "Published" ? "Published" : "Draft";
    draft.value.pictures = [...(record?.pictures || [])];
  }
  if (kind === "signals") {
    draft.value.id = record?.id || record?._id || undefined;
    draft.value.direction = record?.direction || "pending";
    draft.value.confirmed = String(
      record?.confirmed === true || record?.confirmed === "true",
    );
  }
  if (kind === "events") {
    draft.value.id = record?.id || record?._id || undefined;
    draft.value.scheduledAt = record
      ? toLocalDateTimeInput(record.scheduledAt)
      : `${calendarDay.value}T09:00`;
  } else if (kind === "signals") {
    draft.value.scheduledAt = toLocalDateTimeInput(record?.scheduledAt);
  }
}
async function upload(e, key) {
  if (modal.value === "documents") {
    const file = e.target.files?.[0];
    if (!file) {
      documentFile.value = null;
      draft.value.file = null;
      return;
    }
    const ext = file.name.split(".").pop().toLowerCase();
    if (
      !["pdf", "doc", "docx", "zip"].includes(ext) ||
      file.size > 10 * 1024 * 1024
    ) {
      e.target.value = "";
      documentFile.value = null;
      draft.value.file = null;
      notify("Use a PDF, DOC, DOCX or ZIP file, maximum 10 MB.");
      return;
    }
    documentFile.value = file;
    draft.value.file = { name: file.name };
    draft.value.type =
      ext === "pdf" ? "PDF" : ext === "zip" ? "ZIP" : "Word Document";
    notify("Document selected. Click Save to upload it.");
    return;
  }
  if (modal.value === "analysis") {
    const files = Array.from(e.target.files || []);
    const existingCount =
      draft.value.id && !replaceAnalysisImages.value
        ? draft.value.pictures?.length || 0
        : 0;
    if (
      existingCount + files.length > 10 ||
      files.some(
        (file) =>
          file.size > 2 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      e.target.value = "";
      analysisImages.value = [];
      notify(
        "Maximum 10 charts in total, each 2 MB or smaller. Select Replace existing charts to upload more.",
      );
      return;
    }
    analysisImages.value = files;
    notify(
      files.length
        ? `${files.length} image(s) selected. Click Save to upload.`
        : "Image selection cleared.",
    );
    return;
  }
  if (modal.value === "signals") {
    const file = e.target.files?.[0];
    signalImage.value = null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      e.target.value = "";
      notify("Use a JPG, PNG or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      e.target.value = "";
      notify("The signal image must be 2 MB or smaller");
      return;
    }
    signalImage.value = file;
    notify("Image selected. Click Save to upload it.");
    return;
  }
  const file = e.target.files[0];
  if (!file) return;
  saving.value = true;
  try {
    const body = new FormData();
    body.append("file", file);
    draft.value[key] = await api("upload", { method: "POST", body });
    notify("File uploaded");
  } catch (e) {
    notify(e.message);
  } finally {
    saving.value = false;
  }
}
async function save() {
  if (saving.value) return;
  if (modal.value === "documents") {
    saving.value = true;
    try {
      const title = String(draft.value.title || "").trim();
      const url = String(draft.value.url || "").trim();
      if (!title) throw new Error("Enter a document title.");
      if (
        !documentFile.value &&
        (url || !draft.value.id || !draft.value.hasFile)
      ) {
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          throw new Error(
            "Select a document file or enter a full HTTP/HTTPS URL.",
          );
        }
        if (!["http:", "https:"].includes(parsed.protocol))
          throw new Error("The document URL must use HTTP or HTTPS.");
      }
      const payload = {
        title,
        description: String(draft.value.description || "").trim(),
        type: draft.value.type,
        url,
        status: draft.value.status === "Published" ? "published" : "draft",
      };
      const result = draft.value.id
        ? await updateAnalysisDocument(
            draft.value.id,
            payload,
            documentFile.value,
          )
        : await createAnalysisDocument(payload, documentFile.value);
      documentFile.value = null;
      modal.value = null;
      await loadRecords();
      notify(
        error.value
          ? "Document saved, but reloading failed. Click Try again."
          : result.message || "Reference document saved successfully",
      );
    } catch (e) {
      notify(e.message || "Could not save reference document.");
    } finally {
      saving.value = false;
    }
    return;
  }
  if (modal.value === "analysis") {
    saving.value = true;
    try {
      if (!draft.value.date)
        throw new Error("Select the analysis date and time.");
      const date = new Date(draft.value.date);
      if (!Number.isFinite(date.getTime()))
        throw new Error("Select a valid analysis date and time.");
      const categories = {
        ICT: "ICT",
        "PD Array": "PDArray",
        PDArray: "PDArray",
        CSNR: "CSNR",
        SMS: "SMS",
      };
      const category = categories[draft.value.category];
      if (!category) throw new Error("Select a valid category.");
      const title = String(draft.value.title || "").trim();
      const symbol = String(draft.value.pair || "").trim();
      const timeframe = String(draft.value.timeframe || "").trim();
      const details = String(draft.value.details || "").trim();
      if (!title || !symbol || !timeframe || !details)
        throw new Error(
          "Complete the title, trading pair, timeframe and details.",
        );
      const existingCount =
        draft.value.id && !replaceAnalysisImages.value
          ? draft.value.pictures?.length || 0
          : 0;
      if (existingCount + analysisImages.value.length > 10)
        throw new Error(
          "Maximum 10 charts in total. Select Replace existing charts to upload more.",
        );
      const payload = {
        title,
        category,
        symbol,
        timeframe,
        date: date.toISOString(),
        details,
        status: draft.value.status === "Published" ? "published" : "draft",
      };
      const result = draft.value.id
        ? await updateAnalysisPost(
            draft.value.id,
            {
              ...payload,
              imagesMode: replaceAnalysisImages.value ? "replace" : "append",
            },
            analysisImages.value,
          )
        : await createAnalysisPost(
            { ...payload, pictures: [] },
            analysisImages.value,
          );
      analysisImages.value = [];
      modal.value = null;
      await loadRecords();
      notify(
        error.value
          ? "Analysis saved, but reloading failed. Click Try again to reload."
          : result.message || "Analysis saved successfully",
      );
    } catch (e) {
      notify(e.message || "Could not save analysis.");
    } finally {
      saving.value = false;
    }
    return;
  }
  if (["events", "signals"].includes(modal.value)) {
    const kind = modal.value;
    saving.value = true;
    try {
      if (!draft.value.scheduledAt)
        throw new Error("Select the news date and time.");
      const scheduledDate = new Date(draft.value.scheduledAt);
      if (!Number.isFinite(scheduledDate.getTime()))
        throw new Error("Select a valid news date and time.");
      const payload = {
        ...draft.value,
        scheduledAt: scheduledDate.toISOString(),
      };
      if (kind === "events") {
        await saveCalendarEvent(payload);
        // Follow a saved event if its date was changed, so it stays easy to find.
        calendarDay.value = localDateKey(scheduledDate);
      } else {
        payload.id = payload.id || payload._id || undefined;
        const title = String(payload.title || "").trim();
        const pair = String(payload.pair || "")
          .trim()
          .toUpperCase();
        const newsType = String(payload.newsType || "").trim();
        const details = String(payload.details || "").trim();
        if (!title || !pair || !newsType)
          throw new Error(
            "Complete the title, pair and news type.",
          );
        const direction = String(payload.direction || "pending").toLowerCase();
        const confirmed =
          payload.confirmed === true || payload.confirmed === "true";
        if (!["pending", "buy", "sell"].includes(direction))
          throw new Error("Select a valid signal direction.");
        if (confirmed && direction === "pending")
          throw new Error(
            "A confirmed signal must have direction buy or sell.",
          );
        Object.assign(payload, {
          title,
          pair,
          newsType,
          details,
          direction,
          confirmed,
        });
        await saveNewsSignal(payload, signalImage.value);
      }
      modal.value = null;
      signalImage.value = null;
      await loadRecords();
      notify(
        error.value
          ? "Saved, but reloading failed. Click Try again."
          : "News date and details saved successfully.",
      );
    } catch (errorCaught) {
      notify(errorCaught.message || "Unable to save news.");
    } finally {
      saving.value = false;
    }
    return;
  }
  saving.value = true;
  try {
    if (
      modal.value === "courses" &&
      !draft.value.attachment &&
      !draft.value.videoUrl
    )
      throw Error("Upload a video or add a hosted video link.");
    if (
      modal.value === "users" &&
      list("users").some(
        (x) =>
          x.id !== draft.value.id &&
          x.email.toLowerCase() === draft.value.email.toLowerCase(),
      )
    )
      throw Error("This email already exists.");
    const data = { ...draft.value };
    const id = data.id;
    delete data.id;
    delete data.kind;
    delete data.createdAt;
    if (data.scheduledAt)
      data.scheduledAt = new Date(data.scheduledAt).toISOString();
    if (modal.value === "tickets")
      data.status = data.status === "Draft" ? "Open" : data.status;
    const r = await api("records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: modal.value, data, id }),
    });
    records.value = records.value.filter((x) => x.id !== r.id);
    records.value.unshift(r);
    modal.value = null;
    notify("Saved successfully");
  } catch (e) {
    notify(e.message);
  } finally {
    saving.value = false;
  }
}
async function remove() {
  if (saving.value || !deleteTarget.value) return;
  if (["analysis", "documents"].includes(deleteTarget.value.kind)) {
    const target = deleteTarget.value;
    saving.value = true;
    try {
      await deleteAnalysisRecord(target);
      records.value = records.value.filter(
        (record) => !(record.kind === target.kind && record.id === target.id),
      );
      deleteTarget.value = null;
      notify(
        target.kind === "documents"
          ? "Reference document deleted"
          : "Analysis deleted",
      );
    } catch (err) {
      notify(err.message || "Could not delete this record. Retry Delete.");
    } finally {
      saving.value = false;
    }
    return;
  }
  if (["events", "signals"].includes(deleteTarget.value?.kind)) {
    saving.value = true;
    try {
      const isNewsSignal = deleteTarget.value.kind === "signals";
      await deleteNewsRecord(deleteTarget.value);
      deleteTarget.value = null;
      await loadRecords();
      notify(isNewsSignal ? "News Signal archived. Subscriptions stay active." : "News deleted successfully");
    } catch (error) {
      notify(error.message);
    } finally {
      saving.value = false;
    }
    return;
  }
  saving.value = true;
  try {
    await api("records/" + deleteTarget.value.id, { method: "DELETE" });
    records.value = records.value.filter((x) => x.id !== deleteTarget.value.id);
    deleteTarget.value = null;
    notify("Record deleted");
  } catch (e) {
    notify(e.message);
  } finally {
    saving.value = false;
  }
}
async function sendReply() {
  if (!reply.value.trim()) return;
  saving.value = true;
  try {
    const ticket = selectedTicket.value;
    const data = {
      ...ticket,
      replies: [
        ...(ticket.replies || []),
        {
          message: reply.value.trim(),
          at: new Date().toISOString(),
          author: profile.value.name,
        },
      ],
    };
    delete data.id;
    delete data.kind;
    delete data.createdAt;
    const r = await api("records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "tickets", id: ticket.id, data }),
    });
    records.value = records.value.map((x) => (x.id === r.id ? r : x));
    selectedTicket.value = r;
    reply.value = "";
    notify("Reply saved to this conversation");
  } catch (e) {
    notify(e.message);
  } finally {
    saving.value = false;
  }
}
async function resolveTicket() {
  const data = { ...selectedTicket.value, status: "Resolved" };
  delete data.id;
  delete data.kind;
  delete data.createdAt;
  try {
    const r = await api("records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "tickets",
        id: selectedTicket.value.id,
        data,
      }),
    });
    records.value = records.value.map((x) => (x.id === r.id ? r : x));
    selectedTicket.value = r;
    notify("Conversation resolved");
  } catch (e) {
    notify(e.message);
  }
}
// Optional growth data: fourteen daily counts supplied by the backend.
const activityBars = computed(() => {
  const counts = dashboardStats.value?.userGrowth;
  return Array.isArray(counts) &&
    counts.length === 14 &&
    counts.every((n) => Number.isInteger(n) && n >= 0)
    ? counts
    : null;
});
const today = new Date().toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
function returnToLogin() {
  router.push("/login");
}
let previousFocus;
watch([modal, deleteTarget], async ([form, deletion]) => {
  if (form || deletion) {
    previousFocus = document.activeElement;
    await nextTick();
    document
      .querySelector(".cmm-admin .modal input, .cmm-admin .modal button")
      ?.focus();
  } else previousFocus?.focus?.();
});
function modalKeys(event) {
  if (!modal.value && !deleteTarget.value) return;
  if (event.key === "Escape" && !saving.value) {
    modal.value = null;
    deleteTarget.value = null;
  }
  if (event.key === "Tab") {
    const controls = [
      ...document.querySelectorAll(
        ".cmm-admin .modal button:not([disabled]), .cmm-admin .modal input:not([disabled]), .cmm-admin .modal select, .cmm-admin .modal textarea, .cmm-admin .modal a",
      ),
    ];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
onMounted(() => {
  document.addEventListener("keydown", modalKeys);
  load();
});
onUnmounted(() => document.removeEventListener("keydown", modalKeys));
</script>

<template>
  <div
    class="cmm-admin min-h-screen bg-slate-50 font-sans text-sm text-slate-800 dark:bg-slate-950 dark:text-slate-100 [&_button]:cursor-pointer [&_svg]:shrink-0 [&_button]:transition-colors [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_a]:cursor-pointer [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-emerald-500 w-full min-w-0 [overflow-wrap:anywhere]"
    :class="{ dark }"
  >
    <div
      v-if="mobile"
      class="scrim fixed inset-0 z-30 bg-slate-950/50"
      @click="mobile = false"
    ></div>
    <aside
      class="sidebar fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pt-7 pb-4 transition-transform max-[1024px]:-translate-x-full max-[1024px]:[&.opened]:translate-x-0 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain max-[768px]:pt-5 max-[600px]:px-3 max-[480px]:w-[240px] max-[414px]:pt-4 max-[320px]:w-[232px] motion-reduce:transition-none"
      :class="{ opened: mobile }"
    >
      <button
        type="button"
        class="ml-auto mb-2 hidden size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 max-[1024px]:inline-flex"
        aria-label="Close navigation"
        @click="mobile = false"
      >
        <X :size="22" />
      </button>
      <a
        class="brand flex items-center gap-3 px-3 text-2xl font-bold tracking-tight [&_small]:mt-1 [&_small]:block [&_small]:text-[10px] [&_small]:font-semibold [&_small]:tracking-wider [&_small]:text-slate-500 max-[600px]:gap-2 max-[600px]:px-2 max-[480px]:text-xl"
        href="#Dashboard"
        @click.prevent="navigate('Dashboard')"
      >
        <span
          class="brand-symbol grid size-10 place-items-center rounded-xl bg-emerald-700 text-white"
          ><img src="../../assets/fav/fav.jpg" class="object-cover rounded-xl"
        /></span>
        <span
          >CMM<span class="brand-light font-normal">-FT</span
          ><small>MANAGEMENT CONSOLE</small></span
        >
      </a>
      <div
        class="workspace mx-1 mt-8 mb-7 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3 [&_strong]:block [&_strong]:text-xs [&_span]:mt-1 [&_span]:block [&_span]:text-xs [&_span]:text-slate-500 [&>svg]:ml-auto [&>svg]:text-emerald-600 max-[768px]:mt-5 max-[768px]:mb-5 max-[600px]:p-2.5 [&>div:not(.workspace-logo)]:min-w-0"
      >
        <div
          class="workspace-logo grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          M
        </div>
        <div>
          <strong>Creator of Money Mentorship-FT</strong
          ><span>Administrator workspace</span>
        </div>
        <ShieldCheck :size="17" />
      </div>
      <p
        class="nav-caption mb-3 px-4 text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400"
      >
        WORKSPACE
      </p>
      <nav
        class="flex flex-col gap-1 [&_button]:flex [&_button]:items-center [&_button]:gap-3 [&_button]:rounded-lg [&_button]:px-4 [&_button]:py-3 [&_button]:text-left [&_button]:text-slate-500 [&_button:hover]:bg-slate-50 [&_button.active]:bg-emerald-50 [&_button.active]:font-semibold [&_button.active]:text-emerald-700 dark:[&_button]:text-slate-400 dark:[&_button:hover]:bg-slate-800 dark:[&_button.active]:bg-emerald-950/50 dark:[&_button.active]:text-emerald-300"
      >
        <button
          v-for="[label, icon] in nav"
          :key="label"
          :class="{ active: page === label }"
          @click="navigate(label)"
        >
          <component :is="icon" :size="20" /><span>{{ label }}</span>
          <span
            v-if="
              label === 'Support' &&
              list('tickets').filter((x) => x.status !== 'Resolved').length
            "
            class="nav-count ml-auto rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            >{{
              list("tickets").filter((x) => x.status !== "Resolved").length
            }}</span
          >
        </button>
      </nav>
      <div class="sidebar-bottom mt-auto pt-8 max-[600px]:pt-5">
        <div
          class="private-note mb-3 flex items-start gap-2 px-2 py-3 text-slate-500 dark:text-slate-400 [&_strong]:block [&_strong]:text-xs [&_span]:mt-1 [&_span]:block [&_span]:text-xs"
        >
          <ShieldCheck :size="19" />
          <div>
            <strong>Admin workspace</strong
            ><span>Access requires an admin account.</span>
          </div>
        </div>
        <button
          class="profile flex w-full items-center gap-3 border-t border-slate-200 dark:border-slate-700 px-2 pt-5 text-left [&_strong]:block [&_strong]:text-sm [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-slate-500 [&>svg]:ml-auto [&>span:not(.avatar)]:min-w-0 [&_strong]:break-words max-[600px]:pt-4"
          @click="open('profile', list('profile')[0])"
        >
          <span
            class="avatar grid size-10 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >{{ initials(profile.name) }}</span
          >
          <span
            ><strong>{{ profile.name }}</strong
            ><small>Administrator</small></span
          ><Settings :size="17" />
        </button>
      </div>
    </aside>
    <div class="main-shell ml-[252px] max-[1024px]:ml-0 min-w-0">
      <header
        class="topbar flex h-[78px] items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-9 max-[768px]:h-16 max-[768px]:px-5 max-[414px]:px-3 min-w-0 max-[600px]:px-4 max-[480px]:gap-2 max-[320px]:px-2 [&>div:first-child]:min-w-0 max-[480px]:[&>div:first-child]:gap-2"
      >
        <div class="flex min-w-0 items-center gap-3">
          <button
            class="icon-btn mobile-menu inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 hidden max-[1024px]:inline-flex max-[768px]:size-11"
            aria-label="Open menu"
            @click="mobile = true"
          >
            <Menu :size="21" />
          </button>
          <span
            class="top-title font-semibold shrink-0 whitespace-nowrap max-[480px]:text-xs"
            >Admin Panel</span
          ><span
            class="divider mx-1 text-slate-300 max-[320px]:hidden max-[480px]:hidden"
            >/</span
          ><span
            class="breadcrumb text-sm text-slate-500 dark:text-slate-400 max-[320px]:hidden truncate max-[480px]:hidden"
            >{{ page }}</span
          >
        </div>
        <div
          class="top-actions flex items-center gap-5 max-[768px]:gap-2 shrink-0 max-[600px]:gap-1 max-[320px]:gap-0"
        >
          <span
            class="secure flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-4 text-xs text-emerald-700 dark:text-emerald-300 max-[768px]:hidden"
            ><ShieldCheck :size="14" />Admin access</span
          >
          <button
            class="icon-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 max-[768px]:size-11"
            :aria-label="dark ? 'Use light theme' : 'Use dark theme'"
            @click="toggleTheme"
          >
            <Sun v-if="dark" :size="19" /><Moon v-else :size="19" />
          </button>
          <div class="profile-dropdown relative">
            <button
              class="top-avatar grid size-9 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              aria-label="Admin profile menu"
              @click="profileMenu = !profileMenu"
            >
              {{ initials(profile.name) }}
            </button>
            <div
              v-if="profileMenu"
              class="dropdown absolute top-12 right-0 z-50 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl [&>strong]:block [&>small]:mt-1 [&>small]:mb-3 [&>small]:block [&>small]:break-all [&>small]:text-slate-500 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:py-2 max-w-[calc(100vw-1.5rem)] max-[480px]:w-56 [&>strong]:break-words"
            >
              <strong>{{ profile.name }}</strong
              ><small>{{ profile.email }}</small>
              <button
                @click="
                  profileMenu = false;
                  open('profile', list('profile')[0]);
                "
              >
                <UserRound :size="16" />My profile</button
              ><button @click="navigate('Settings')">
                <Settings :size="16" />Settings</button
              ><button @click="returnToLogin">
                <LogOut :size="16" />Back to login
              </button>
            </div>
          </div>
        </div>
      </header>
      <main
        class="min-w-0 w-full mx-auto max-w-[1600px] px-9 pt-8 pb-5 max-[768px]:px-5 max-[600px]:pt-6 max-[480px]:px-4 max-[414px]:px-3 max-[320px]:px-2"
      >
        <div
          v-if="error"
          class="error-banner mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 [&_button]:ml-3 [&_button]:underline break-words max-[480px]:p-3"
        >
          {{ error }} <button @click="load">Try again</button>
        </div>
        <div
          class="page-heading mb-7 flex items-center justify-between gap-5 max-[600px]:flex-col max-[600px]:items-start [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_p]:mt-2 [&_p]:text-sm [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:items-start max-[600px]:gap-4 max-[480px]:mb-5 max-[480px]:[&_h1]:text-2xl max-[320px]:[&_h1]:text-xl [&_p]:leading-relaxed max-[600px]:[&_p]:text-sm"
        >
          <div>
            <div
              class="eyebrow mb-2 text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400"
            >
              {{
                page === "Dashboard"
                  ? "WORKSPACE OVERVIEW"
                  : "WORKSPACE / " + page.toUpperCase()
              }}
            </div>
            <h1>
              {{
                page === "Dashboard"
                  ? "Dashboard"
                  : page === "Support"
                    ? "Support inbox"
                    : page === "News"
                      ? "News & signals"
                      : page === "Users"
                        ? "User management"
                        : page
              }}
            </h1>
            <p>
              {{
                {
                  Dashboard: "A clear view of your community and content.",
                  News: "Manage economic events, News Signals, and monthly Daily Signals.",
                  Academy: "Build your course library and manage pricing.",
                  Analysis:
                    "Share your technical outlook and downloadable resources.",
                  Users: "Manage members and approve access to specific news signals.",
                  Support: "Read messages and keep track of your replies.",
                  Settings: "Manage your workspace preferences.",
                }[page]
              }}
            </p>
          </div>
          <div
            class="heading-actions flex items-center gap-3 max-[600px]:w-full max-[600px]:justify-end flex-wrap max-[480px]:justify-start max-[480px]:[&>button]:w-full max-[480px]:[&>button]:whitespace-normal"
          >
            <div
              v-if="page === 'Dashboard'"
              class="date-pill flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 max-[768px]:hidden"
            >
              <CalendarDays :size="16" />{{ today }}
            </div>
            <button
              v-if="page === 'Dashboard'"
              type="button"
              :disabled="dashboardLoading"
              @click="fetchDashboard"
              class="rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50 max-[768px]:min-h-11"
            >
              {{ dashboardLoading ? "Loading…" : "Refresh" }}
            </button>
            <button
              v-if="page === 'Analysis'"
              type="button"
              @click="open('documents')"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <Plus :size="17" />Add reference document
            </button>
            <button
              v-if="currentKind && page !== 'Academy' && !(page === 'News' && tab === 'Daily')"
              class="btn-primary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 bg-emerald-700 text-white hover:bg-emerald-800 max-[768px]:min-h-11 max-[414px]:px-3"
              @click="open(currentKind)"
            >
              <Plus :size="17" />{{
                {
                  events: "Add event",
                  signals: "Upload signal",
                  courses: "Add course",
                  analysis: "Add analysis",
                  users: "Add user",
                }[currentKind]
              }}
            </button>
            <button
              v-if="page === 'Support'"
              class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
              @click="open('tickets')"
            >
              <Plus :size="17" />Add conversation
            </button>
          </div>
        </div>
        <template v-if="page === 'Dashboard'">
          <section aria-labelledby="paid-users-heading" class="mb-6 w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 max-[600px]:p-3">
            <div class="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h2 id="paid-users-heading" class="text-lg font-semibold">Payment history</h2>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Separate News and Daily Signal payments by product, user ID and status. Daily expiry comes from the saved subscription. Summary cards show all-time verified payments.</p>
              </div>
              <button type="button" :disabled="paidLoading" @click="fetchPaidPayments(paidPagination.page)" class="min-h-11 w-full shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50 sm:w-auto dark:border-slate-700">
                {{ paidLoading ? "Loading…" : "Refresh payments" }}
              </button>
            </div>
            <form @submit.prevent="fetchPaidPayments(1)" class="mb-5 grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(110px,150px)] xl:grid-cols-[minmax(0,1fr)_minmax(110px,150px)_minmax(150px,180px)_auto_auto]">
              <label class="col-span-2 min-w-0 text-sm sm:col-span-1">
                <span class="mb-1 block">User ID (optional)</span>
                <input v-model="paymentUserIdFilter" :disabled="paidLoading" maxlength="24" placeholder="Paste user ID" class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 text-base sm:text-sm dark:border-slate-600" />
              </label>
              <label class="col-span-2 min-w-0 text-sm sm:col-span-1">
                <span class="mb-1 block">Status</span>
                <select v-model="paymentStatusFilter" :disabled="paidLoading" class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base sm:text-sm dark:border-slate-600 dark:bg-slate-900">
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="expired">Expired</option>
                  <option value="all">All orders</option>
                </select>
              </label>
              <label class="col-span-2 min-w-0 text-sm sm:col-span-1">
                <span class="mb-1 block">Product</span>
                <select v-model="paymentProductFilter" :disabled="paidLoading" class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base sm:text-sm dark:border-slate-600 dark:bg-slate-900">
                  <option value="all">All products</option>
                  <option value="news-signal">News Signals</option>
                  <option value="daily-signal">Daily Signals</option>
                  <option value="course">Courses</option>
                </select>
              </label>
              <button type="submit" :disabled="paidLoading" class="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white">Apply filters</button>
              <button type="button" :disabled="paidLoading" @click="paymentUserIdFilter = ''; paymentStatusFilter = 'paid'; paymentProductFilter = 'all'; fetchPaidPayments(1)" class="min-h-11 rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-600">Reset</button>
            </form>
            <div class="mb-5 grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-6">
              <article v-for="card in paidCards" :key="card.label" class="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-700 dark:bg-slate-800">
                <p class="text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</p>
                <p class="mt-2 break-words text-xl font-semibold sm:text-2xl">{{ card.value ?? '—' }}</p>
              </article>
            </div>
            <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">Course, News and Daily buyer counts can overlap. Manually granted access is excluded unless a paid receipt exists.</p>
            <div v-if="paidError" role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {{ paidError }}
              <button type="button" :disabled="paidLoading" @click="fetchPaidPayments(paidPagination.page)" class="ml-2 min-h-11 underline disabled:opacity-50">Try again</button>
              <p v-if="paidSummary" class="mt-1 text-xs">Counts above are from the last successful refresh.</p>
            </div>
            <p v-if="paidLoading" role="status" class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading payment history…</p>
            <template v-else-if="!paidError">
              <div v-if="paidPayments.length" class="min-w-0">
                <!-- Mobile: each order has its own card, with no sideways scrolling. -->
                <div class="grid min-w-0 grid-cols-1 gap-3 md:hidden" role="list" aria-label="Payment history">
                  <article v-for="payment in paidPayments" :key="payment.orderId" role="listitem" class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <div class="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div class="min-w-0 flex-1 basis-36">
                        <p class="break-words font-semibold">{{ payment.name || 'User unavailable' }}</p>
                        <p class="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{{ payment.email || 'Email unavailable' }}</p>
                      </div>
                      <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize" :class="payment.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : payment.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">{{ payment.status }}</span>
                    </div>
                    <dl class="mt-4 grid min-w-0 grid-cols-1 gap-3 border-t border-slate-200 pt-3 min-[400px]:grid-cols-2 dark:border-slate-700">
                      <div class="min-w-0">
                        <dt class="text-xs text-slate-500 dark:text-slate-400">Product</dt>
                        <dd class="mt-1 break-words font-medium">{{ paidProductLabel(payment) }}</dd>
                      </div>
                      <div class="min-w-0">
                        <dt class="text-xs text-slate-500 dark:text-slate-400">Amount</dt>
                        <dd class="mt-1 break-words font-semibold">{{ money(payment.amount) }} {{ payment.currency }}</dd>
                      </div>
                      <div class="min-w-0 min-[400px]:col-span-2">
                        <dt class="text-xs text-slate-500 dark:text-slate-400">Paid at (local time)</dt>
                        <dd class="mt-1 break-words">{{ payment.paidAt ? date(payment.paidAt) + ' ' + time(payment.paidAt) : '—' }}</dd>
                      </div>
                      <div v-if="isMonthlySignalPayment(payment)" class="min-w-0 min-[400px]:col-span-2">
                        <dt class="text-xs text-slate-500 dark:text-slate-400">Access from this payment</dt>
                        <dd class="mt-1 font-medium">{{ subscriptionAccessLabel(payment) }}</dd>
                        <dd class="mt-1 break-words text-sm">Expires: {{ subscriptionExpiryLabel(payment) }}</dd>
                      </div>
                      <div v-for="field in [{ label: 'User ID', value: payment.userId }, { label: 'Product ID', value: payment.productId }, { label: 'Order ID', value: payment.orderId }]" :key="field.label" class="min-w-0 min-[400px]:col-span-2">
                        <dt class="text-xs text-slate-500 dark:text-slate-400">{{ field.label }}</dt>
                        <dd class="mt-1 break-all text-xs leading-5">{{ field.value }}</dd>
                      </div>
                    </dl>
                  </article>
                </div>
                <!-- Tablet and desktop: keep the table's scrolling inside this panel. -->
                <div class="hidden max-w-full overflow-x-auto rounded-lg border border-slate-200 md:block dark:border-slate-700" tabindex="0" role="region" aria-label="Payment history table">
                <table class="w-full min-w-[980px] text-left text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th scope="col" class="px-4 py-3">Buyer</th>
                      <th scope="col" class="px-4 py-3">Product</th>
                      <th scope="col" class="px-4 py-3">Amount</th>
                      <th scope="col" class="px-4 py-3">Paid at (local time)</th>
                      <th scope="col" class="px-4 py-3">Access status / expires (local time)</th>
                      <th scope="col" class="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                    <tr v-for="payment in paidPayments" :key="payment.orderId">
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ payment.name || 'User unavailable' }}</p>
                        <p class="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{{ payment.email || 'Email unavailable' }}</p>
                        <p class="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">User: {{ payment.userId }}</p>
                      </td>
                      <td class="px-4 py-3">
                        <p class="font-medium">{{ paidProductLabel(payment) }}</p>
                        <p class="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{{ payment.productId }}</p>
                        <p class="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">Order: {{ payment.orderId }}</p>
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 font-medium">{{ money(payment.amount) }} {{ payment.currency }}</td>
                      <td class="whitespace-nowrap px-4 py-3">{{ date(payment.paidAt) }} {{ payment.paidAt ? time(payment.paidAt) : '' }}</td>
                      <td class="px-4 py-3">
                        <template v-if="isMonthlySignalPayment(payment)">
                          <p class="font-medium">{{ subscriptionAccessLabel(payment) }}</p>
                          <p class="mt-1 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{{ subscriptionExpiryLabel(payment) }}</p>
                        </template>
                        <span v-else>—</span>
                      </td>
                      <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-medium capitalize" :class="payment.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : payment.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">{{ payment.status }}</span></td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
              <p v-else class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No payment orders match these filters.</p>
              <div class="mt-4 flex min-w-0 flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span class="text-slate-500 dark:text-slate-400">Page {{ paidPagination.page }} of {{ Math.max(1, paidPagination.totalPages) }} · {{ paidPagination.total }} matching orders</span>
                <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <button type="button" :disabled="paidLoading || paidPagination.page <= 1" @click="fetchPaidPayments(paidPagination.page - 1)" class="min-h-11 rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-40 dark:border-slate-700">Previous</button>
                  <button type="button" :disabled="paidLoading || paidPagination.page >= paidPagination.totalPages" @click="fetchPaidPayments(paidPagination.page + 1)" class="min-h-11 rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-40 dark:border-slate-700">Next</button>
                </div>
              </div>
            </template>
          </section>

          <div
            v-if="dashboardError"
            role="alert"
            class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {{ dashboardError
            }}<button
              type="button"
              @click="fetchDashboard"
              :disabled="dashboardLoading"
              class="ml-2 underline"
            >
              Try again
            </button>
            <p v-if="dashboardStats" class="mt-2 text-xs">
              Showing the last successfully fetched counts.
            </p>
          </div>
          <div
            class="welcome-strip mb-6 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/40 max-[600px]:p-4 [&_strong]:block [&_strong]:font-semibold [&_span:not(.workspace-label)]:mt-1 [&_span:not(.workspace-label)]:block [&_span:not(.workspace-label)]:text-xs [&_span:not(.workspace-label)]:text-slate-500 dark:[&_span:not(.workspace-label)]:text-slate-400 min-w-0 [&>div:not(.welcome-icon)]:min-w-0 max-[480px]:gap-2 max-[480px]:p-3 max-[414px]:items-start max-[320px]:p-2.5"
          >
            <div
              class="welcome-icon grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 max-[320px]:hidden"
            >
              <Activity :size="24" />
            </div>
            <div>
              <strong>{{ greetings }}, {{ profile.name.split(" ")[0] }}.</strong
              ><span>Everything you need to manage CMM-FT, in one place.</span>
            </div>
            <span
              class="workspace-label ml-auto shrink-0 rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 max-[768px]:hidden"
              >Your workspace</span
            >
          </div>
          <div
            class="stats-grid mb-6 grid gap-4 max-[480px]:gap-2 min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] max-[768px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[600px]:gap-3 max-[414px]:gap-2 max-[320px]:gap-1.5"
          >
            <div
              v-for="s in statCards"
              :key="s.label"
              class="stat-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 min-w-0 max-[600px]:p-4 max-[414px]:p-3 max-[320px]:p-2.5"
            >
              <div
                class="stat-label flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400 min-w-0 max-[414px]:gap-1 max-[320px]:text-xs"
              >
                {{ s.label
                }}<span
                  class="stat-icon grid size-8 shrink-0 place-items-center rounded-lg [&.mint]:bg-emerald-50 [&.mint]:text-emerald-700 [&.blue]:bg-blue-50 [&.blue]:text-blue-600 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-600 max-[480px]:hidden"
                  :class="s.color"
                  ><component :is="s.icon" :size="19"
                /></span>
              </div>
              <strong
                class="stat-value mt-3 mb-2 block text-3xl font-semibold tracking-tight max-[600px]:text-2xl max-[480px]:mt-2 max-[320px]:text-xl"
                >{{
                  dashboardLoading && !dashboardStats
                    ? "…"
                    : s.value == null
                      ? "—"
                      : s.value.toLocaleString()
                }}</strong
              ><span
                class="stat-note block text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-[320px]:text-xs"
                >{{ s.note }}</span
              >
            </div>
          </div>
          <div
            class="overview-grid mb-6 grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-6 max-[768px]:grid-cols-1 max-[768px]:gap-4 min-w-0 max-[1024px]:gap-4 max-[600px]:gap-3"
          >
            <section
              class="panel growth-panel overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 max-w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Community growth</h2>
                  <p>New members over the last 14 days</p>
                </div>
                <span
                  class="subtle-pill shrink-0 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400"
                  >14 days</span
                >
              </div>
              <div
                class="chart-top flex items-center justify-between gap-3 px-6 [&>strong]:text-2xl [&>strong>span]:ml-2 [&>strong>span]:text-xs [&>strong>span]:font-normal [&>strong>span]:text-slate-500 flex-wrap min-w-0 max-[600px]:px-4 max-[414px]:px-3 max-[320px]:gap-2"
              >
                <strong
                  >{{
                    activityBars
                      ? activityBars.reduce((a, b) => a + b, 0)
                      : "—"
                  }}<span>new members</span></strong
                ><span
                  class="chart-key flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 [&_i]:size-2 [&_i]:rounded-full [&_i]:bg-emerald-600"
                  ><i></i>Registrations</span
                >
              </div>
              <div
                class="chart relative mx-6 mt-4 h-36 max-[600px]:mx-4 max-[480px]:h-32 max-[414px]:mx-3 max-[320px]:h-28"
              >
                <div
                  class="chart-lines absolute inset-0 flex flex-col justify-between [&_span]:border-t [&_span]:border-dashed [&_span]:border-slate-200 dark:[&_span]:border-slate-700"
                >
                  <span v-for="i in 4"></span>
                </div>
                <div
                  class="bars absolute inset-0 flex items-end gap-2 max-[480px]:gap-1 max-[320px]:gap-0.5"
                >
                  <div
                    v-for="(n, i) in activityBars || []"
                    :key="i"
                    class="bar-slot flex h-full flex-1 items-end [&>div]:min-h-px [&>div]:w-full [&>div]:rounded-t [&>div]:bg-emerald-400"
                  >
                    <div
                      :title="n + ' registrations'"
                      :style="{
                        height:
                          (n
                            ? Math.max(
                                5,
                                (n / Math.max(...activityBars, 1)) * 100,
                              )
                            : 1) + '%',
                      }"
                    ></div>
                  </div>
                </div>
                <div
                  v-if="!activityBars"
                  class="chart-empty absolute inset-0 grid place-items-center text-center text-xs text-slate-500 dark:text-slate-400 px-3 leading-relaxed"
                >
                  Daily registration data is not available yet
                </div>
              </div>
              <div
                class="chart-dates flex justify-between gap-2 px-6 pt-3 pb-5 text-xs text-slate-500 dark:text-slate-400 max-[600px]:px-4 max-[414px]:px-3 max-[414px]:[&>span:nth-child(2)]:hidden"
              >
                <span>{{ date(Date.now() - 13 * 86400000) }}</span
                ><span>{{ date(Date.now() - 7 * 86400000) }}</span
                ><span>Today</span>
              </div>
            </section>
            <section
              class="panel content-panel overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 max-w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Content at a glance</h2>
                  <p>Your publishing workspace</p>
                </div>
              </div>
              <button
                v-for="c in [
                  {
                    label: 'News signals',
                    kind: 'signals',
                    icon: Newspaper,
                    page: 'News',
                  },
                  {
                    label: 'Academy courses',
                    kind: 'courses',
                    icon: GraduationCap,
                    page: 'Academy',
                  },
                  {
                    label: 'Technical analysis',
                    kind: 'analysis',
                    icon: ChartNoAxesCombined,
                    page: 'Analysis',
                  },
                  {
                    label: 'Calendar events',
                    kind: 'events',
                    icon: CalendarDays,
                    page: 'News',
                  },
                ]"
                class="content-row flex w-full items-center gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 [&_strong]:block [&_strong]:text-sm [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-slate-500 [&>b]:ml-auto [&>b]:text-lg [&>svg]:text-slate-400 min-w-0 [&>span:not(.content-icon)]:min-w-0 [&_strong]:break-words max-[600px]:px-4 max-[480px]:gap-2 max-[414px]:px-3"
                @click="
                  navigate(c.page);
                  tab = c.kind === 'signals' ? 'Signals' : 'Calendar';
                "
              >
                <span
                  class="content-icon grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  ><component :is="c.icon" :size="20" /></span
                ><span
                  ><strong>{{ c.label }}</strong
                  ><small
                    >{{
                      recordsLoaded
                        ? list(c.kind).filter(
                            (x) =>
                              x.status === "Published" ||
                              x.status === "Released",
                          ).length
                        : "—"
                    }}
                    published / released</small
                  ></span
                ><b>{{ recordsLoaded ? list(c.kind).length : "—" }}</b
                ><ChevronRight :size="16" />
              </button>
            </section>
          </div>
          <div
            class="bottom-grid grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-6 max-[768px]:grid-cols-1 max-[768px]:gap-4 min-w-0 max-[1024px]:gap-4 max-[600px]:gap-3"
          >
            <section
              class="panel overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 max-w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Recent activity</h2>
                  <p>The latest changes across your workspace</p>
                </div>
              </div>
              <div
                v-if="!recent.length"
                class="empty-inline px-6 pt-7 pb-9 text-center text-slate-500 dark:text-slate-400 [&>svg]:mx-auto [&>svg]:mb-3 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-slate-700 dark:[&_h3]:text-slate-200 [&_p]:text-xs [&_p]:leading-relaxed max-[600px]:px-4 max-[480px]:py-6"
              >
                <span
                  class="empty-icon inline-grid size-14 place-items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  ><Activity :size="25"
                /></span>
                <h3>
                  {{
                    recordsLoaded
                      ? "A fresh start"
                      : "Activity not connected yet"
                  }}
                </h3>
                <p>
                  {{
                    recordsLoaded
                      ? "Publish content to see activity here."
                      : "User counts are connected. Content and activity data will appear when those endpoints are connected."
                  }}
                </p>
              </div>
              <div
                v-for="r in recent"
                class="activity-row flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4 [&_strong]:block [&_strong]:text-sm [&_div>span]:mt-1 [&_div>span]:block [&_div>span]:text-xs [&_div>span]:text-slate-500 [&>.badge]:ml-auto min-w-0 [&>div]:min-w-0 [&_strong]:break-words max-[600px]:px-4 max-[480px]:flex-wrap max-[414px]:px-3"
              >
                <span
                  class="activity-dot size-2 shrink-0 rounded-full bg-emerald-600"
                ></span>
                <div>
                  <strong>{{ r.title || r.name }}</strong
                  ><span>{{ r.kind }} · {{ date(r.createdAt) }}</span>
                </div>
                <span
                  class="badge inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                  >{{ r.status || "Saved" }}</span
                >
              </div>
            </section>
            <section
              class="panel quick-panel overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 max-w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Quick actions</h2>
                  <p>Keep your workspace moving</p>
                </div>
              </div>
              <div
                class="quick-actions px-6 pb-5 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-3 [&_button]:py-3 [&_button]:text-left [&_button]:text-slate-500 [&_button:hover]:text-emerald-600 [&_button>svg:last-child]:ml-auto dark:[&_button]:text-slate-400 max-[600px]:px-4 max-[414px]:px-3 [&_button>span]:min-w-0 [&_button>span]:break-words max-[768px]:[&_button]:min-h-11"
              >
                <button
                  v-for="a in [
                    {
                      label: 'Add calendar event',
                      kind: 'events',
                      icon: CalendarDays,
                    },
                    {
                      label: 'Upload news signal',
                      kind: 'signals',
                      icon: Upload,
                    },
                    {
                      label: 'Create a course',
                      kind: 'courses',
                      icon: GraduationCap,
                    },
                    { label: 'Add a member', kind: 'users', icon: Users },
                  ]"
                  @click="open(a.kind)"
                >
                  <component :is="a.icon" :size="18" /><span>{{ a.label }}</span
                  ><Plus :size="16" />
                </button>
              </div>
            </section>
          </div>
        </template>
        <template v-else-if="page === 'Academy'"><CourseAdmin /></template>
        <template v-else-if="currentKind">
          <div
            v-if="page === 'News'"
            class="tabs mb-6 flex min-w-0 max-w-full flex-nowrap gap-4 overflow-x-auto whitespace-nowrap border-b border-slate-200 sm:gap-6 dark:border-slate-700 [&_button]:flex [&_button]:min-h-11 [&_button]:shrink-0 [&_button]:items-center [&_button]:gap-2 [&_button]:border-b-2 [&_button]:border-transparent [&_button]:pb-3 [&_button]:text-sm [&_button]:text-slate-500 [&_button.selected]:border-emerald-600 [&_button.selected]:text-emerald-700 dark:[&_button]:text-slate-400 dark:[&_button.selected]:text-emerald-300 [&_span]:rounded [&_span]:bg-emerald-50 [&_span]:px-1.5 [&_span]:text-xs dark:[&_span]:bg-emerald-900/40"
          >
            <button
              :class="{ selected: tab === 'Calendar' }"
              @click="
                tab = 'Calendar';
                filter = 'All';
              "
            >
              <CalendarDays :size="17" />Economic calendar<span>{{
                list("events").length
              }}</span>
            </button>
            <button
              :class="{ selected: tab === 'Signals' }"
              @click="
                tab = 'Signals';
                filter = 'All';
              "
            >
              <Newspaper :size="17" />News signals<span>{{
                list("signals").length
              }}</span>
            </button>
            <button
              type="button"
              :class="{ selected: tab === 'Daily' }"
              :aria-pressed="tab === 'Daily'"
              @click="tab = 'Daily'; filter = 'All'"
            >
              <TrendingUp :size="17" />Daily signals
            </button>
          </div>

          <SignalHistoryAdmin v-if="page === 'News'" class="mb-6" />
          <DailySignalAdmin v-if="page === 'News' && tab === 'Daily'" />
          <template v-else>
          <!-- Only economic calendar records are filtered by this selected day. -->
          <section
            v-if="isCalendar"
            aria-labelledby="calendar-day-heading"
            class="mb-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 max-[600px]:p-4 max-[414px]:p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="min-w-0">
                <h2
                  id="calendar-day-heading"
                  class="flex items-start gap-2 text-base font-semibold"
                >
                  <CalendarDays :size="20" />{{ calendarDayLabel }}
                </h2>
                <p
                  class="mt-2 text-xs text-slate-500 dark:text-slate-400"
                  role="status"
                  aria-live="polite"
                >
                  {{ calendarDayEvents.length }} event{{
                    calendarDayEvents.length === 1 ? "" : "s"
                  }}
                  on this day · {{ calendarTimezone }}
                </p>
              </div>
              <div class="flex flex-wrap items-end gap-2 max-[600px]:w-full">
                <button
                  type="button"
                  @click="changeCalendarDay(-1)"
                  class="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 max-[480px]:flex-1"
                >
                  <ChevronRight :size="16" class="rotate-180" />Previous day
                </button>
                <button
                  type="button"
                  @click="showCalendarToday"
                  class="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  Today
                </button>
                <button
                  type="button"
                  @click="changeCalendarDay(1)"
                  class="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 max-[480px]:flex-1"
                >
                  Next day<ChevronRight :size="16" />
                </button>
                <label class="min-w-0 max-[600px]:w-full">
                  <span
                    class="mb-1 block text-xs text-slate-500 dark:text-slate-400"
                    >Select date</span
                  >
                  <input
                    type="date"
                    :value="calendarDay"
                    @change="selectCalendarDay($event.target.value)"
                    class="min-h-11 max-w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 dark:border-slate-700 max-[600px]:w-full"
                  />
                </label>
              </div>
            </div>
          </section>

          <section
            class="panel listing overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-w-0 max-w-full"
          >
            <div
              class="list-toolbar flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 p-5 max-[600px]:flex-wrap [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-200 [&_select]:bg-transparent [&_select]:p-2 dark:[&_select]:border-slate-700 min-w-0 max-[600px]:p-4 max-[414px]:p-3 max-[600px]:[&>div:last-child]:w-full max-[600px]:[&>div:last-child]:justify-between [&_select]:max-w-full"
            >
              <div
                class="search-input flex w-72 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-slate-500 dark:text-slate-400 max-[600px]:w-full [&_input]:w-full [&_input]:bg-transparent [&_input]:outline-none min-w-0 max-w-full [&_input]:min-w-0 max-[768px]:min-h-11"
              >
                <Search :size="18" /><input
                  v-model="search"
                  :placeholder="
                    isCalendar ? 'Search this day’s events…' : 'Search records…'
                  "
                  :aria-label="
                    isCalendar
                      ? 'Search selected day’s events'
                      : 'Search records'
                  "
                />
              </div>
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="result-count whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"
                  >{{ visible.length }}
                  {{ isCalendar ? "events on this day" : "records" }}</span
                ><select
                  v-if="page === 'Analysis' || page === 'Users'"
                  v-model="filter"
                  aria-label="Filter records"
                >
                  <option>All</option>
                  <option
                    v-for="x in page === 'Analysis'
                      ? ['ICT', 'PD Array', 'CSNR', 'SMS']
                      : ['Active', 'Suspended']"
                  >
                    {{ x }}
                  </option>
                </select>
              </div>
            </div>
            <div
              v-if="loading"
              class="empty-state px-5 py-16 text-center [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-5 [&_p]:text-sm [&_p]:text-slate-500 dark:[&_p]:text-slate-400 max-[600px]:px-4 max-[600px]:py-12 max-[480px]:py-9 max-[320px]:[&_h2]:text-base [&>button]:max-w-full [&>button]:whitespace-normal"
            >
              <div
                class="spinner mx-auto mb-4 size-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-600 motion-reduce:animate-none"
              ></div>
              <p>Loading your workspace…</p>
            </div>
            <div
              v-else-if="!visible.length"
              class="empty-state px-5 py-16 text-center [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-5 [&_p]:text-sm [&_p]:text-slate-500 dark:[&_p]:text-slate-400 max-[600px]:px-4 max-[600px]:py-12 max-[480px]:py-9 max-[320px]:[&_h2]:text-base [&>button]:max-w-full [&>button]:whitespace-normal"
            >
              <span
                class="empty-icon inline-grid size-14 place-items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                ><component
                  :is="
                    page === 'Academy'
                      ? GraduationCap
                      : page === 'Users'
                        ? Users
                        : page === 'News'
                          ? Newspaper
                          : ChartNoAxesCombined
                  "
                  :size="32"
              /></span>
              <h2>
                {{
                  search || filter !== "All"
                    ? "No matching records"
                    : isCalendar
                      ? "No events for this day"
                      : "Your " +
                        {
                          events: "calendar",
                          signals: "signal library",
                          courses: "course library",
                          analysis: "analysis library",
                          users: "member list",
                        }[currentKind] +
                        " starts here"
                }}
              </h2>
              <p>
                {{
                  search
                    ? isCalendar
                      ? "Try another search or select another day."
                      : "Try another search."
                    : isCalendar
                      ? "Select another date or add an event for " +
                        calendarDayLabel +
                        "."
                      : "Add your first record to start managing this section."
                }}
              </p>
              <button
                v-if="!search"
                class="btn-primary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 bg-emerald-700 text-white hover:bg-emerald-800 max-[768px]:min-h-11 max-[414px]:px-3"
                @click="open(currentKind)"
              >
                <Plus :size="17" />{{
                  isCalendar
                    ? "Add event for this day"
                    : "Add your first " +
                      {
                        events: "event",
                        signals: "signal",
                        courses: "course",
                        analysis: "analysis",
                        users: "user",
                      }[currentKind]
                }}
              </button>
            </div>
            <div
              v-else-if="
                ['courses', 'signals', 'analysis'].includes(currentKind)
              "
              class="cards-grid grid grid-cols-3 gap-5 p-5 max-[1200px]:grid-cols-2 max-[600px]:grid-cols-1 min-w-0 max-[768px]:gap-4 max-[600px]:p-4 max-[480px]:gap-3 max-[414px]:p-3"
            >
              <article
                v-for="r in visible"
                class="record-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 min-w-0"
              >
                <div
                  class="record-cover relative flex h-40 items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 [&_img]:h-full [&_img]:w-full [&_img]:object-contain [&_video]:h-full [&_video]:w-full [&_video]:object-contain max-[480px]:h-44 max-[320px]:h-36"
                  :class="currentKind"
                >
                  <img
                    v-if="currentKind === 'analysis' && r.pictures?.length"
                    :src="fileUrl(r.pictures[0])"
                    :alt="r.title"
                    class="block h-auto w-full rounded-lg object-contain"
                  /><img
                    v-else-if="r.attachment?.type?.startsWith('image/')"
                    :src="fileUrl(r.attachment.url)"
                    :alt="r.title"
                  /><video
                    v-else-if="currentKind === 'courses' && r.attachment"
                    :src="fileUrl(r.attachment.url)"
                    controls
                    preload="metadata"
                  ></video
                  ><component
                    v-else
                    :is="
                      currentKind === 'courses'
                        ? Play
                        : currentKind === 'signals'
                          ? TrendingUp
                          : FileText
                    "
                    :size="40"
                  /><span
                    class="cover-label absolute bottom-3 left-3 rounded-md bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 max-w-[calc(100%-1.5rem)] break-words"
                    >{{ r.category || r.pair || "ACADEMY" }}</span
                  >
                </div>
                <div
                  class="record-body p-5 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:line-clamp-3 [&_p]:min-h-10 [&_p]:whitespace-pre-wrap [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 max-[600px]:p-4 max-[414px]:p-3 [&_h3]:break-words [&>div:first-child]:flex-wrap"
                >
                  <div class="flex justify-between gap-3">
                    <span
                      class="badge inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                      :class="r.status === 'Published' ? 'green' : ''"
                      >{{ r.status }}</span
                    ><span
                      class="muted text-xs text-slate-500 dark:text-slate-400"
                      >{{
                        currentKind === "courses"
                          ? money(r.price)
                          : date(r.scheduledAt || r.createdAt)
                      }}</span
                    >
                  </div>
                  <h3>{{ r.title }}</h3>
                  <p>{{ r.description || r.details }}</p>
                  <span
                    v-if="r.audience"
                    class="access-label mt-3 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0 [&_svg]:shrink-0"
                    ><ShieldCheck :size="13" />{{ r.audience }}</span
                  >
                  <div
                    class="record-actions mt-4 flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 pt-3 [&>.delete-btn]:ml-auto min-w-0 flex-wrap max-[414px]:gap-2"
                  >
                    <button
                      class="text-button inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                      @click="open(currentKind, r)"
                    >
                      <Pencil :size="15" />Edit</button
                    ><a
                      v-if="r.attachment"
                      :href="fileUrl(r.attachment.url)"
                      target="_blank"
                      rel="noopener"
                      class="text-button inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                      ><Download :size="15" />{{
                        currentKind === "courses" ? "View video" : "Download"
                      }}</a
                    ><a
                      v-else-if="r.videoUrl"
                      :href="externalUrl(r.videoUrl)"
                      target="_blank"
                      rel="noopener"
                      class="text-button inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                      >View video</a
                    ><button
                      class="icon-btn delete-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40 max-[768px]:size-11"
                      aria-label="Delete record"
                      @click="deleteTarget = r"
                    >
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </div>
              </article>
            </div>
            <div
              v-else
              class="table-wrap overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:whitespace-nowrap [&_table]:text-left [&_table]:text-sm [&_th]:bg-slate-50 [&_th]:px-6 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-200 [&_td]:px-6 [&_td]:py-4 [&_td_small]:mt-1 [&_td_small]:text-xs dark:[&_th]:bg-slate-800 dark:[&_td]:border-slate-700 w-full min-w-0 max-w-full overscroll-x-contain touch-auto [-webkit-overflow-scrolling:touch] max-[768px]:[&_table]:min-w-[860px] max-[768px]:[&_th]:px-4 max-[768px]:[&_td]:px-4 max-[480px]:[&_th]:px-3 max-[480px]:[&_td]:px-3"
            >
              <table>
                <thead>
                  <tr>
                    <template v-if="currentKind === 'users'"
                      ><th>Member</th>
                      <th>Role</th>
                      <th>Signal access</th>
                      <th>Status</th>
                      <th>Joined</th></template
                    ><template v-else
                      ><th>Event / country</th>
                      <th>Date & time</th>
                      <th>Currency</th>
                      <th>Impact</th>
                      <th>Actual</th>
                      <th>Forecast</th>
                      <th>Previous</th>
                      <th>Status</th></template
                    >
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in visible" :key="r.id || r._id">
                    <template v-if="currentKind === 'users'">
                      <td>
                        <div
                          class="member-cell flex items-center gap-3 [&_strong]:block [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-slate-500"
                        >
                          <span
                            class="avatar small grid size-10 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 size-8"
                            >{{ initials(r.name) }}</span
                          ><span
                            ><strong>{{ r.name }}</strong
                            ><small>{{ r.email }}</small></span
                          >
                        </div>
                      </td>
                      <td>{{ r.role }}</td>
                      <td>
                        <button type="button" :disabled="saving || userSignalSaving"
                          @click="openUserSignalAccess(r)"
                          class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300">
                          <ShieldCheck :size="16" />Manage signals
                        </button>
                      </td>
                      <td>
                        <span
                          class="badge inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                          :class="r.status === 'Active' ? 'green' : 'orange'"
                          >{{ r.status }}</span
                        >
                      </td>
                      <td>{{ date(r.createdAt) }}</td>
                    </template>
                    <template v-else>
                      <td>
                        <strong>{{ r.title }}</strong
                        ><small
                          class="block muted text-xs text-slate-500 dark:text-slate-400"
                          >{{ r.country }}</small
                        >
                      </td>
                      <td>
                        {{ date(r.scheduledAt)
                        }}<small
                          class="block muted text-xs text-slate-500 dark:text-slate-400"
                          >{{ time(r.scheduledAt) }}</small
                        >
                      </td>
                      <td>
                        <b>{{ r.currency }}</b>
                      </td>
                      <td>
                        <span
                          class="badge inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                          :class="
                            r.impact === 'High'
                              ? 'red'
                              : r.impact === 'Medium'
                                ? 'orange'
                                : ''
                          "
                          >{{ r.impact }}</span
                        >
                      </td>
                      <td>{{ r.actual || "—" }}</td>
                      <td>{{ r.forecast || "—" }}</td>
                      <td>{{ r.previous || "—" }}</td>
                      <td>{{ r.status }}</td>
                    </template>
                    <td>
                      <div class="flex gap-1">
                        <button
                          class="icon-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 max-[768px]:size-11"
                          aria-label="Edit record"
                          @click="open(currentKind, r)"
                        >
                          <Pencil :size="16" /></button
                        ><button
                          class="icon-btn delete-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40 max-[768px]:size-11"
                          aria-label="Delete record"
                          @click="deleteTarget = r"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <p
            v-if="page === 'Users'"
            class="section-note my-5 flex items-center gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 min-w-0 items-start max-[480px]:text-xs"
          >
            <ShieldCheck :size="15" />Use Manage signals to unlock a specific signal for the registered account with this email.
            Each new signal needs its own purchase or admin approval.
          </p>
          </template>
        </template>
        <template v-else-if="page === 'Support'">
          <div
            class="connection-note my-5 flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 min-w-0 max-[600px]:p-3 max-[480px]:text-xs"
          >
            <CircleHelp :size="18" /><span
              >Connect your public support form to receive messages here.
              Conversations and replies added here are saved in this
              workspace.</span
            >
          </div>
          <section
            class="panel inbox overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 grid min-h-[490px] grid-cols-[320px_minmax(0,1fr)] max-[1200px]:grid-cols-[260px_minmax(0,1fr)] max-[768px]:grid-cols-1 min-w-0 max-w-full"
          >
            <div
              class="ticket-list border-r border-slate-200 dark:border-slate-700 max-[768px]:border-r-0 max-[768px]:border-b min-w-0 max-[768px]:max-h-[320px] max-[768px]:overflow-y-auto max-[480px]:max-h-[280px]"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <h2>Conversations</h2>
                <span
                  class="subtle-pill shrink-0 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400"
                  >{{ list("tickets").length }}</span
                >
              </div>
              <div
                v-if="!list('tickets').length"
                class="empty-inline px-6 pt-7 pb-9 text-center text-slate-500 dark:text-slate-400 [&>svg]:mx-auto [&>svg]:mb-3 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-slate-700 dark:[&_h3]:text-slate-200 [&_p]:text-xs [&_p]:leading-relaxed max-[600px]:px-4 max-[480px]:py-6"
              >
                <MessagesSquare :size="27" />
                <h3>No messages yet</h3>
                <p>Add a conversation to start.</p>
              </div>
              <button
                v-for="t in list('tickets')"
                class="ticket w-full border-t border-slate-200 dark:border-slate-700 px-6 py-5 text-left [&.selected]:bg-emerald-50 dark:[&.selected]:bg-emerald-950/40 [&>div]:flex [&>div]:justify-between [&>div]:gap-2 [&>b]:mt-3 [&>b]:mb-2 [&>b]:block [&>p]:truncate [&>p]:text-xs [&>p]:text-slate-500 [&>small]:mt-2 [&>small]:block [&>small]:text-xs [&>small]:text-slate-500 min-w-0 [&>div]:flex-wrap max-[600px]:px-4 max-[414px]:px-3"
                :class="{ selected: selectedTicket?.id === t.id }"
                @click="selectedTicket = t"
              >
                <div>
                  <strong>{{ t.name }}</strong
                  ><span
                    class="badge inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                    :class="t.status === 'Resolved' ? 'green' : ''"
                    >{{ t.status }}</span
                  >
                </div>
                <b>{{ t.title }}</b>
                <p>{{ t.message }}</p>
                <small>{{ date(t.createdAt) }}</small>
              </button>
            </div>
            <div class="conversation flex min-h-72 min-w-0 flex-col">
              <div
                v-if="!selectedTicket"
                class="empty-state px-5 py-16 text-center [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-5 [&_p]:text-sm [&_p]:text-slate-500 dark:[&_p]:text-slate-400 max-[600px]:px-4 max-[600px]:py-12 max-[480px]:py-9 max-[320px]:[&_h2]:text-base [&>button]:max-w-full [&>button]:whitespace-normal"
              >
                <span
                  class="empty-icon inline-grid size-14 place-items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  ><MessagesSquare :size="32"
                /></span>
                <h2>Your support conversations</h2>
                <p>Select a message to read and reply.</p>
              </div>
              <template v-else>
                <div
                  class="conversation-head flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 p-6 [&_h2]:font-semibold [&_p]:mt-2 [&_p]:text-xs [&_p]:text-slate-500 min-w-0 [&>div]:min-w-0 [&_h2]:break-words [&_p]:break-words max-[600px]:flex-col max-[600px]:p-4 max-[414px]:p-3"
                >
                  <div>
                    <h2>{{ selectedTicket.title }}</h2>
                    <p>
                      {{ selectedTicket.name }} · {{ selectedTicket.email }}
                    </p>
                  </div>
                  <button
                    v-if="selectedTicket.status !== 'Resolved'"
                    class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
                    @click="resolveTicket"
                  >
                    <Check :size="16" />Resolve
                  </button>
                </div>
                <div
                  class="messages max-h-[450px] flex-1 overflow-y-auto p-6 min-w-0 max-[600px]:p-4 max-[414px]:p-3"
                >
                  <div
                    class="message mb-4 max-w-[85%] rounded-lg bg-slate-50 dark:bg-slate-800 p-4 [&_strong]:text-xs [&_p]:my-2 [&_p]:whitespace-pre-wrap [&_p]:text-sm [&_p]:leading-relaxed [&_small]:text-xs [&_small]:text-slate-500 min-w-0 max-[600px]:max-w-[95%] max-[414px]:p-3 [&_p]:[overflow-wrap:anywhere]"
                  >
                    <strong>{{ selectedTicket.name }}</strong>
                    <p>{{ selectedTicket.message }}</p>
                    <small>{{ date(selectedTicket.createdAt) }}</small>
                  </div>
                  <div
                    v-for="r in selectedTicket.replies"
                    class="message admin-message mb-4 max-w-[85%] rounded-lg bg-slate-50 dark:bg-slate-800 p-4 [&_strong]:text-xs [&_p]:my-2 [&_p]:whitespace-pre-wrap [&_p]:text-sm [&_p]:leading-relaxed [&_small]:text-xs [&_small]:text-slate-500 ml-auto !bg-emerald-50 dark:!bg-emerald-950/40 min-w-0 max-[600px]:max-w-[95%] max-[414px]:p-3 [&_p]:[overflow-wrap:anywhere]"
                  >
                    <strong>{{ r.author }}</strong>
                    <p>{{ r.message }}</p>
                    <small>{{ date(r.at) }}</small>
                  </div>
                </div>
                <form
                  class="reply-form border-t border-slate-200 dark:border-slate-700 p-5 [&_textarea]:w-full [&_textarea]:min-h-24 [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:bg-transparent [&_textarea]:p-3 dark:[&_textarea]:border-slate-700 [&>div]:mt-3 [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-3 [&_small]:text-xs [&_small]:text-slate-500 max-[600px]:[&>div]:flex-col max-[600px]:[&>div]:items-end min-w-0 max-[600px]:p-4 max-[414px]:p-3 [&_textarea]:min-w-0 max-[480px]:[&>div>button]:w-full"
                  @submit.prevent="sendReply"
                >
                  <textarea
                    v-model="reply"
                    placeholder="Write your reply…"
                    required
                    aria-label="Reply"
                  ></textarea>
                  <div>
                    <small
                      >Saved here. Public delivery needs backend
                      integration.</small
                    ><button
                      class="btn-primary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 bg-emerald-700 text-white hover:bg-emerald-800 max-[768px]:min-h-11 max-[414px]:px-3"
                      :disabled="saving || !reply.trim()"
                    >
                      <Send :size="16" />Save reply
                    </button>
                  </div>
                </form>
              </template>
            </div>
          </section>
        </template>
        <template v-else-if="page === 'Settings'">
          <div
            class="settings-grid grid grid-cols-2 gap-6 max-[768px]:grid-cols-1 min-w-0 max-[600px]:gap-4 max-[414px]:gap-3"
          >
            <section
              class="panel settings-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 pb-6 [&>.panel-heading]:px-0 [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-5 [&_dt]:text-slate-500 [&_dd]:text-right [&_dd]:break-words min-w-0 max-w-full max-[600px]:px-4 max-[600px]:pb-4 max-[414px]:px-3 max-[480px]:[&_dl]:grid-cols-1 max-[480px]:[&_dl]:gap-2 max-[480px]:[&_dd]:mb-3 max-[480px]:[&_dd]:text-left [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] max-[480px]:[&>button]:w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Workspace preferences</h2>
                  <p>Your site identity and content defaults</p>
                </div>
                <Settings :size="22" />
              </div>
              <dl>
                <template
                  v-for="[k, l] in [
                    ['siteName', 'Site name'],
                    ['supportEmail', 'Support email'],
                    ['timezone', 'Calendar timezone'],
                    ['defaultAccess', 'Default signal access'],
                  ]"
                  ><dt>{{ l }}</dt>
                  <dd>
                    {{
                      list("settings")[0]?.[k] ||
                      {
                        siteName: "CMM-FT",
                        timezone: "Asia/Phnom_Penh",
                        defaultAccess: "Subscribers only",
                      }[k] ||
                      "Not set"
                    }}
                  </dd></template
                >
              </dl>
              <button
                class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
                @click="open('settings', list('settings')[0])"
              >
                <Pencil :size="16" />Edit preferences
              </button>
            </section>
            <section
              class="panel settings-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 pb-6 [&>.panel-heading]:px-0 [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-5 [&_dt]:text-slate-500 [&_dd]:text-right [&_dd]:break-words min-w-0 max-w-full max-[600px]:px-4 max-[600px]:pb-4 max-[414px]:px-3 max-[480px]:[&_dl]:grid-cols-1 max-[480px]:[&_dl]:gap-2 max-[480px]:[&_dd]:mb-3 max-[480px]:[&_dd]:text-left [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] max-[480px]:[&>button]:w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Appearance</h2>
                  <p>Choose a comfortable workspace theme</p>
                </div>
                <Sun :size="22" />
              </div>
              <div
                class="theme-options my-4 flex gap-4 [&_button]:flex [&_button]:flex-1 [&_button]:items-center [&_button]:gap-3 [&_button]:rounded-xl [&_button]:border [&_button]:border-slate-200 [&_button]:bg-slate-50 [&_button]:p-5 dark:[&_button]:border-slate-700 dark:[&_button]:bg-slate-800 [&_button.selected]:border-emerald-500 [&_button.selected]:bg-emerald-50 dark:[&_button.selected]:bg-emerald-950/40 [&_button>svg:last-child]:ml-auto max-[414px]:gap-2 max-[414px]:[&_button]:p-3 min-w-0 [&_button]:min-w-0 max-[600px]:gap-3 max-[414px]:[&_button]:gap-2 max-[320px]:flex-col max-[320px]:[&_button]:w-full"
              >
                <button :class="{ selected: !dark }" @click="setTheme(false)">
                  <Sun :size="26" /><strong>Light</strong
                  ><Check v-if="!dark" :size="16" /></button
                ><button :class="{ selected: dark }" @click="setTheme(true)">
                  <Moon :size="26" /><strong>Dark</strong
                  ><Check v-if="dark" :size="16" />
                </button>
              </div>
            </section>
            <section
              class="panel settings-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 pb-6 [&>.panel-heading]:px-0 [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-5 [&_dt]:text-slate-500 [&_dd]:text-right [&_dd]:break-words min-w-0 max-w-full max-[600px]:px-4 max-[600px]:pb-4 max-[414px]:px-3 max-[480px]:[&_dl]:grid-cols-1 max-[480px]:[&_dl]:gap-2 max-[480px]:[&_dd]:mb-3 max-[480px]:[&_dd]:text-left [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] max-[480px]:[&>button]:w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Admin profile</h2>
                  <p>Your workspace identity</p>
                </div>
                <UserRound :size="22" />
              </div>
              <div
                class="profile-details my-5 flex items-center gap-4 [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 min-w-0 [&>div]:min-w-0 [&_h3]:break-words [&_p]:[overflow-wrap:anywhere] max-[414px]:gap-3"
              >
                <span
                  class="avatar grid size-10 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  >{{ initials(profile.name) }}</span
                >
                <div>
                  <h3>{{ profile.name }}</h3>
                  <p>{{ profile.email || "Administrator" }}</p>
                </div>
              </div>
              <button
                class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
                @click="open('profile', list('profile')[0])"
              >
                <Pencil :size="16" />Edit profile
              </button>
            </section>
            <section
              class="panel settings-card overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 pb-6 [&>.panel-heading]:px-0 [&_dl]:my-6 [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-5 [&_dt]:text-slate-500 [&_dd]:text-right [&_dd]:break-words min-w-0 max-w-full max-[600px]:px-4 max-[600px]:pb-4 max-[414px]:px-3 max-[480px]:[&_dl]:grid-cols-1 max-[480px]:[&_dl]:gap-2 max-[480px]:[&_dd]:mb-3 max-[480px]:[&_dd]:text-left [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] max-[480px]:[&>button]:w-full"
            >
              <div
                class="panel-heading flex items-center justify-between gap-3 px-6 pt-6 pb-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-slate-500 dark:[&_p]:text-slate-400 min-w-0 [&>div]:min-w-0 max-[768px]:px-5 max-[600px]:px-4 max-[600px]:pt-5 max-[600px]:pb-4 max-[480px]:gap-2 max-[414px]:px-3 max-[320px]:[&_h2]:text-sm"
              >
                <div>
                  <h2>Workspace access</h2>
                  <p>Private by default</p>
                </div>
                <ShieldCheck :size="22" />
              </div>
              <p
                class="settings-description my-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400"
              >
                Your backend must verify the admin role on every administrative
                request. Member login and subscription access are managed by
                your existing authentication service.
              </p>
              <span
                class="badge green inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 [&.green]:bg-emerald-50 [&.green]:text-emerald-700 [&.purple]:bg-violet-50 [&.purple]:text-violet-600 [&.orange]:bg-orange-50 [&.orange]:text-orange-700 [&.red]:bg-red-50 [&.red]:text-red-600 dark:[&.green]:bg-emerald-900/30 dark:[&.green]:text-emerald-300 dark:[&.purple]:bg-violet-900/30 dark:[&.orange]:bg-orange-900/30 dark:[&.red]:bg-red-900/30"
                >Admin access required</span
              >
            </section>
          </div>
        </template>
        <section
          v-if="page === 'Analysis'"
          aria-labelledby="admin-documents-heading"
          class="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        >
          <header
            class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-6 dark:border-slate-700 max-[600px]:p-4 max-[414px]:p-3"
          >
            <div>
              <h2 id="admin-documents-heading" class="text-lg font-semibold">
                Download References
              </h2>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Documents shown below the technical analysis on your public
                page.
              </p>
            </div>
            <button
              type="button"
              @click="open('documents')"
              class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 max-[480px]:w-full max-[480px]:justify-center"
            >
              <Plus :size="17" />Add document
            </button>
          </header>
          <p
            v-if="loading"
            role="status"
            class="p-6 text-slate-500 dark:text-slate-400"
          >
            Loading documents…
          </p>
          <p
            v-else-if="!error && !list('documents').length"
            class="p-6 text-slate-500 dark:text-slate-400"
          >
            No reference documents yet. Click Add document to create one.
          </p>
          <div v-else class="divide-y divide-slate-200 dark:divide-slate-700">
            <article
              v-for="document in list('documents')"
              :key="document.id"
              class="flex items-center justify-between gap-4 p-6 max-[600px]:flex-col max-[600px]:items-start max-[600px]:p-4 max-[414px]:p-3"
            >
              <div class="min-w-0">
                <h3 class="break-words font-semibold">{{ document.title }}</h3>
                <p
                  class="mt-1 break-words text-sm text-slate-500 dark:text-slate-400"
                >
                  {{ document.description }}
                </p>
                <p
                  class="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                >
                  {{ document.type }} · {{ document.status }}
                </p>
              </div>
              <div
                class="flex shrink-0 flex-wrap items-center gap-2 max-[480px]:w-full"
              >
                <a
                  v-if="!document.pendingDelete && externalUrl(document.url)"
                  :href="externalUrl(document.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700 max-[480px]:w-full"
                  ><Download :size="16" />Open document</a
                ><button
                  type="button"
                  :disabled="saving || document.pendingDelete"
                  @click="open('documents', document)"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700 max-[480px]:flex-1"
                >
                  <Pencil :size="16" />Edit</button
                ><button
                  type="button"
                  :disabled="saving"
                  @click="deleteTarget = document"
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400 max-[480px]:flex-1"
                >
                  <Trash2 :size="16" />{{
                    document.pendingDelete ? "Retry Delete" : "Delete"
                  }}
                </button>
              </div>
            </article>
          </div>
        </section>
        <footer
          class="max-[480px]:flex-col max-[480px]:gap-2 max-[320px]:text-xs mt-8 flex justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-4 text-xs text-slate-500 dark:text-slate-400"
        >
          <span
            >CMM-FT <span class="footer-dot px-1.5">·</span> Admin Panel</span
          ><span>Money Mentorship</span>
        </footer>
      </main>
    </div>
    <div
      v-if="toast"
      class="toast fixed bottom-6 left-1/2 z-100 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-900 px-5 py-3 text-sm text-white shadow-xl min-w-0 max-[600px]:bottom-4 max-[480px]:w-[calc(100vw-1.5rem)] max-[480px]:max-w-none max-[414px]:px-3"
      role="status"
    >
      <Check :size="18" />{{ toast }}
    </div>
    <div
      v-if="modal"
      class="modal-backdrop fixed inset-0 z-70 flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm max-[600px]:p-3 overflow-y-auto max-[768px]:p-4 max-[414px]:p-2"
      @click.self="!saving && (modal = null)"
    >
      <section
        class="modal max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl [&_h2]:text-xl [&_h2]:font-semibold min-w-0 max-[768px]:max-h-[calc(100dvh-2rem)] max-[414px]:max-h-[calc(100dvh-1rem)] max-[480px]:rounded-xl [&_h2]:break-words max-[480px]:[&_h2]:text-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div
          class="modal-head flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 px-7 py-6 max-[600px]:px-5 min-w-0 [&>div]:min-w-0 max-[480px]:px-4 max-[480px]:py-4 max-[414px]:px-3"
        >
          <div>
            <div
              class="eyebrow mb-2 text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400"
            >
              CMM-FT WORKSPACE
            </div>
            <h2 id="form-title">
              {{ draft.id ? "Edit" : "Add" }}
              {{
                {
                  events: "calendar event",
                  signals: "news signal",
                  courses: "course",
                  analysis: "technical analysis",
                  documents: "reference document",
                  users: "user",
                  tickets: "conversation",
                  profile: "admin profile",
                  settings: "preferences",
                }[modal]
              }}
            </h2>
          </div>
          <button
            class="icon-btn inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 max-[768px]:size-11"
            aria-label="Close"
            :disabled="saving"
            @click="modal = null"
          >
            <X :size="21" />
          </button>
        </div>
        <form @submit.prevent="save">
          <div
            class="form-grid grid grid-cols-2 gap-5 px-7 py-6 max-[480px]:grid-cols-1 max-[600px]:px-5 [&_label>span]:mb-2 [&_label>span]:block [&_label>span]:text-sm [&_label_b]:font-normal [&_label_b]:text-emerald-600 [&_input:not([type=file])]:w-full [&_input:not([type=file])]:min-w-0 [&_input:not([type=file])]:rounded-lg [&_input:not([type=file])]:border [&_input:not([type=file])]:border-slate-200 [&_input:not([type=file])]:bg-transparent [&_input:not([type=file])]:p-3 dark:[&_input:not([type=file])]:border-slate-700 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:p-3 dark:[&_select]:border-slate-700 dark:[&_select]:bg-slate-900 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:bg-transparent [&_textarea]:p-3 dark:[&_textarea]:border-slate-700 [&_input:focus]:outline-emerald-500 [&_textarea:focus]:outline-emerald-500 [&_select:focus]:outline-emerald-500 min-w-0 [&_label]:min-w-0 [&_input]:max-w-full [&_select]:min-w-0 max-[768px]:gap-4 max-[600px]:grid-cols-1 max-[480px]:px-4 max-[480px]:py-4 max-[414px]:px-3"
          >
            <label
              v-for="[key, label, type, required, options] in fields[modal]"
              :key="key"
              :class="{
                'col-span-2 max-[600px]:col-span-1':
                  type === 'textarea' || type === 'file',
              }"
              ><span>{{ label }}<b v-if="required"> *</b></span>
              <select
                v-if="type === 'select'"
                v-model="draft[key]"
                :required="required"
              >
                <option v-for="o in options">{{ o }}</option>
              </select>
              <textarea
                v-else-if="type === 'textarea'"
                v-model="draft[key]"
                :required="required"
                rows="3"
              ></textarea>
              <div
                v-else-if="type === 'file'"
                class="upload-field rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5 text-center text-slate-500 dark:text-slate-400 [&_svg]:mx-auto [&_svg]:mb-2 [&_span]:my-2 [&_span]:block [&_small]:my-2 [&_small]:block [&_small]:text-xs [&_input]:max-w-full [&_input]:text-xs [&_input]:file:mr-2 [&_input]:file:rounded [&_input]:file:border-0 [&_input]:file:bg-emerald-100 [&_input]:file:px-3 [&_input]:file:py-2 [&_input]:file:text-emerald-800 min-w-0 [&_span]:break-words max-[480px]:p-3 [&_input]:w-full [&_input]:min-w-0 max-[320px]:[&_input]:file:px-2"
              >
                <Upload :size="23" /><span>{{
                  modal === "analysis"
                    ? analysisImages.length
                      ? `${analysisImages.length} image(s) selected`
                      : "Choose chart images"
                    : modal === "signals"
                      ? signalImage?.name || (draft.hasImage ? "Existing image saved — choose a file to replace it" : "Optional — add the chart later")
                      : draft[key]?.name || "Choose a file to upload"
                }}</span
                ><input
                  type="file"
                  :accept="options"
                  :multiple="modal === 'analysis'"
                  :disabled="saving"
                  @change="upload($event, key)"
                /><small>{{
                  modal === "analysis"
                    ? "Up to 10 images · 2 MB each · JPG, PNG, WebP"
                    : modal === "documents"
                      ? "Maximum document size: 10 MB · PDF, DOC, DOCX, ZIP"
                      : modal === "signals"
                        ? "Optional · Maximum image size: 2 MB · Upload now or when editing later"
                        : "Maximum file size: 100 MB"
                }}</small>
              </div>
              <input
                v-else
                v-model="draft[key]"
                :type="type"
                :required="required"
                :min="type === 'number' ? 0 : undefined"
                :step="type === 'number' ? '0.01' : undefined"
              />
              <small
                v-if="type === 'datetime-local'"
                class="mt-2 block text-xs text-slate-500 dark:text-slate-400"
                >Timezone:
                {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}</small
              >
            </label>
          </div>
          <div
            v-if="modal === 'analysis' && draft.id"
            class="mx-7 mb-5 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700 max-[480px]:mx-4 max-[414px]:mx-3"
          >
            <p class="text-sm font-medium">
              Existing charts: {{ draft.pictures?.length || 0 }}
            </p>
            <div v-if="draft.pictures?.length" class="flex flex-wrap gap-2">
              <a
                v-for="(picture, index) in draft.pictures"
                :key="picture"
                :href="picture"
                target="_blank"
                rel="noopener noreferrer"
                ><img
                  :src="picture"
                  crossorigin="use-credentials"
                  :alt="`Existing chart ${index + 1}`"
                  class="h-20 w-28 rounded border border-slate-200 object-contain dark:border-slate-700"
              /></a>
            </div>
            <label class="flex items-start gap-2 text-sm"
              ><input
                v-model="replaceAnalysisImages"
                type="checkbox"
                :disabled="saving"
                class="mt-1"
              /><span
                >Replace all existing charts with the selected images.</span
              ></label
            >
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                replaceAnalysisImages
                  ? "Saving replaces the old charts. With no selected images, it removes all charts."
                  : "Existing charts stay. Selected images are added, up to 10 charts in total."
              }}
            </p>
          </div>
          <p
            v-if="modal === 'documents' && draft.id && draft.hasFile"
            class="mx-7 mb-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-[480px]:mx-4 max-[414px]:mx-3"
          >
            Current file: {{ draft.filename || "Uploaded document" }}. Leave the
            upload and URL empty to keep it. Select a new file or enter a hosted
            URL to replace it.
          </p>
          <p
            v-if="modal === 'users'"
            class="form-note mx-7 mb-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-[480px]:mx-4 max-[414px]:mx-3"
          >
            Member details are saved here. To unlock a news signal, use Manage signals in the user list
            and select the specific signal. The email must match the registered website account.
          </p>
          <div
            class="modal-footer flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-7 py-5 max-[600px]:px-5 min-w-0 max-[480px]:px-4 max-[480px]:py-4 max-[414px]:flex-col-reverse max-[414px]:px-3 max-[414px]:[&>button]:w-full max-[414px]:[&>button]:whitespace-normal"
          >
            <button
              type="button"
              class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
              :disabled="saving"
              @click="modal = null"
            >
              Cancel</button
            ><button
              class="btn-primary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 bg-emerald-700 text-white hover:bg-emerald-800 max-[768px]:min-h-11 max-[414px]:px-3"
              :disabled="saving"
            >
              {{
                saving
                  ? "Saving…"
                  : "Save " +
                    {
                      events: "event",
                      signals: "signal",
                      courses: "course",
                      analysis: "analysis",
                      documents: "document",
                      users: "user",
                      tickets: "conversation",
                      profile: "profile",
                      settings: "preferences",
                    }[modal]
              }}
            </button>
          </div>
        </form>
      </section>
    </div>
    <div
      v-if="deleteTarget"
      class="modal-backdrop fixed inset-0 z-70 flex items-center justify-center bg-slate-950/50 p-6 backdrop-blur-sm max-[600px]:p-3 overflow-y-auto max-[768px]:p-4 max-[414px]:p-2"
      @click.self="!saving && (deleteTarget = null)"
    >
      <section
        class="modal confirm-modal max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl [&_h2]:text-xl [&_h2]:font-semibold !max-w-[410px] p-6 [&>p]:my-5 [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-slate-500 [&>.modal-footer]:px-0 [&>.modal-footer]:pb-0 min-w-0 max-[768px]:max-h-[calc(100dvh-2rem)] max-[414px]:max-h-[calc(100dvh-1rem)] max-[480px]:rounded-xl [&_h2]:break-words max-[480px]:[&_h2]:text-lg max-[480px]:p-4 max-[414px]:p-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">Delete this record?</h2>
        <p>
          “{{ deleteTarget.title || deleteTarget.name }}” will be removed from
          the workspace.
        </p>
        <div
          class="modal-footer flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-7 py-5 max-[600px]:px-5 min-w-0 max-[480px]:px-4 max-[480px]:py-4 max-[414px]:flex-col-reverse max-[414px]:px-3 max-[414px]:[&>button]:w-full max-[414px]:[&>button]:whitespace-normal"
        >
          <button
            class="btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 max-[768px]:min-h-11 max-[414px]:px-3"
            :disabled="saving"
            @click="deleteTarget = null"
          >
            Cancel</button
          ><button
            class="btn-danger inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 max-[768px]:min-h-11 max-[414px]:px-3"
            :disabled="saving"
            @click="remove"
          >
            {{ saving ? "Deleting…" : "Delete record" }}
          </button>
        </div>
      </section>
    </div>
    <div v-if="userSignalModal"
      class="fixed inset-0 z-80 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      @click.self="closeUserSignalAccess" @keydown.esc="closeUserSignalAccess">
      <section role="dialog" aria-modal="true" aria-labelledby="user-signal-title"
        class="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-center justify-between gap-3">
          <h2 id="user-signal-title" class="text-lg font-semibold">Monthly News Signal access</h2>
          <button type="button" aria-label="Close" :disabled="userSignalSaving" @click="closeUserSignalAccess"
            class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-50"><X :size="20" /></button>
        </div>
        <p class="mt-3 break-words font-medium">{{ userSignalModal.name }}</p>
        <p class="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{{ userSignalModal.email }}</p>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Grant all News Signals for one calendar month from now. New cards are included. Daily Signal access is separate. Repeating approval resets the manual period from now; a later paid expiry still applies.
        </p>
        <p v-if="userSignalsLoading" role="status" class="mt-4 text-sm">Loading signals…</p>
        <form v-else class="mt-5 space-y-4" @submit.prevent="approveUserSignalAccess">
          <p v-if="userSignalError" role="alert" class="break-words text-sm text-red-600 dark:text-red-400">{{ userSignalError }}</p>
          <button v-if="userSignalError" type="button" :disabled="userSignalSaving"
            @click="openUserSignalAccess(userSignalModal)" class="text-sm font-semibold underline">Try again</button>
          <div class="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" :disabled="userSignalSaving" @click="closeUserSignalAccess"
              class="min-h-11 rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-50 dark:border-slate-700">Cancel</button>
            <button type="submit" :disabled="userSignalSaving"
              class="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
              {{ userSignalSaving ? "Approving…" : "Grant 1 Month of News Access" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
