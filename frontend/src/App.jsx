import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Ticket,
  Clock3,
  BarChart3,
  Users,
  FileText,
  Settings,
  LogOut,
  Bell,
  Search,
  Plus,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2, 
  ArrowLeft,
  AlertTriangle,
  Circle,
  Menu,
  X,
  ShieldCheck,
  UserPlus,
  Send,
  BookOpen,
  UploadCloud,
  Film,
  Image,
  Printer,
  Timer,
  TrendingUp,
  TrendingDown,
  Minus,
  Users2,
  Gauge,
} from "lucide-react";

import "./App.css";

/* =========================
   HELPER: SAFE DATE PARSER
========================= */

const parseDate = (dateString) => {
  if (!dateString) return null;

  const formatted = String(dateString).trim().replace(" ", "T");

  // SQLite timestamps without timezone information are stored in UTC.
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(formatted);

  const parsed = new Date(
    hasTimezone ? formatted : `${formatted}Z`
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};


/* =========================
   SHARED ANALYTICS HELPERS
========================= */

const HOUR_MS = 1000 * 60 * 60;

const ANALYTICS_PERIODS = [
  { id: "all", label: "All time", days: null },
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
];

const REPORT_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "sla", label: "SLA & resolution" },
  { id: "agents", label: "Agent performance" },
  { id: "volume", label: "Volume trends" },
];

const average = (values) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const getResolutionHours = (ticket) => {
  if (!ticket || !ticket.created_at || !ticket.resolved_at) return null;

  const created = parseDate(ticket.created_at);
  const resolved = parseDate(ticket.resolved_at);

  if (!created || !resolved) return null;

  const hours = (resolved.getTime() - created.getTime()) / HOUR_MS;

  return Number.isFinite(hours) && hours >= 0 ? hours : null;
};

const formatDuration = (hours) => {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) {
    return "N/A";
  }

  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours >= 24) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(1)} hrs`;
};

const filterTicketsByPeriod = (tickets, days) => {
  if (!days) return tickets;

  const cutoff = Date.now() - days * 24 * HOUR_MS;

  return tickets.filter((ticket) => {
    const created = parseDate(ticket.created_at);
    return created && created.getTime() >= cutoff;
  });
};

const isCompletedTicket = (ticket) =>
  ["Resolved", "Closed"].includes(ticket.status);

const CHART_COLORS = {
  grid: "#e9eef2",
  axis: "#6a7b8b",
  primary: "#14688a",
  secondary: "#58a8bf",
  muted: "#4f6d8a",
  warning: "#b95f22",
  danger: "#b5374a",
  success: "#14795b",
};


/* =========================
   MAIN APP COMPONENT
========================= */

function App() {
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [showRegister, setShowRegister] = useState(false);

  // Load tickets from backend API
  useEffect(() => {
    const loadTickets = async () => {
      try {
        setTicketsLoading(true);

        const response = await fetch("http://localhost:5001/api/tickets", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load tickets.");
        }

        setTickets(data);
      } catch (error) {
        console.error("Failed to load tickets:", error);
      } finally {
        setTicketsLoading(false);
      }
    };

    if (loggedIn) {
      loadTickets();
    }
  }, [loggedIn]);

  // Auth Handlers
  const handleLogin = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setCurrentUser(user);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setLoggedIn(false);
    setTickets([]);
  };

  // JWT Expiration Checker
  useEffect(() => {
    const checkTokenExpiration = () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setCurrentUser(null);
        setLoggedIn(false);
        setTickets([]);
        return;
      }

      try {
        const payload = token.split(".")[1];
        if (!payload) throw new Error("Invalid token.");

        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decodedPayload = JSON.parse(atob(base64));
        const expiresAt = decodedPayload.exp;

        if (!expiresAt || Date.now() >= expiresAt * 1000) {
          handleLogout();
        }
      } catch (error) {
        console.error("Token validation failed:", error);
        handleLogout();
      }
    };

    checkTokenExpiration();
    const intervalId = setInterval(checkTokenExpiration, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRegisterSuccess = () => {
    setShowRegister(false);
    alert("Registration successful. Please log in with your new account.");
  };

  // Delete ticket handler with Authorization header
  const deleteTicket = async (ticket) => {
    const idToDelete = typeof ticket === "object" ? ticket.id : ticket;

    const confirmed = window.confirm(
      "Are you sure you want to delete this ticket?"
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/tickets/${idToDelete}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete ticket.");
      }

      setTickets((current) =>
        current.filter(
          (t) => t.id !== idToDelete && t.ticket_number !== idToDelete
        )
      );

      alert("Ticket deleted successfully.");
    } catch (error) {
      console.error("Failed to delete ticket:", error);
      alert(error.message);
    }
  };

  if (!loggedIn) {
    if (showRegister) {
      return (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onBackToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <Login
        onLogin={handleLogin}
        onRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppLayout
        tickets={tickets}
        setTickets={setTickets}
        ticketsLoading={ticketsLoading}
        currentUser={currentUser}
        onLogout={handleLogout}
        onDelete={deleteTicket}
      />
    </BrowserRouter>
  );
}

/* =========================
   LOGIN & REGISTER
========================= */

function Login({ onLogin, onRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const response = await fetch("http://localhost:5001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    if (!data.token || !data.user) {
      throw new Error("Invalid login response from server.");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    onLogin(data.token, data.user);
  } catch (error) {
    setError(error.message || "Unable to connect to server.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="login-page">
      <div className="login-card">
      <div className="login-logo">
        <img src="/logo-headset-shield.png" alt="IT ServiceHub Logo" />
      </div>
        <h1>IT ServiceHub</h1>
        <p className="login-subtitle">Help Desk & SLA Analytics</p>

        <form onSubmit={handleLogin}>
          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button className="primary-btn login-btn" type="submit" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="auth-switch">
          <span>Don't have an account?</span>
          <button type="button" className="auth-link" onClick={onRegister}>
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}

function Register({ onRegisterSuccess, onBackToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      setSuccess("Registration successful! You can now sign in.");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        onRegisterSuccess();
      }, 1200);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <UserPlus size={30} />
        </div>
        <h1>Create Account</h1>
        <p className="login-subtitle">Join IT ServiceHub</p>

        <form onSubmit={handleRegister}>
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Enter password again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && <p className="login-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button className="primary-btn login-btn" type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-switch">
          <span>Already have an account?</span>
          <button type="button" className="auth-link" onClick={onBackToLogin}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   LAYOUT
========================= */


function AppLayout({ tickets, setTickets, currentUser, onLogout, onDelete }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const token = localStorage.getItem("token");
  const notificationStorageKey = "readAlertIds";

  // Normalize the current user's role
  const currentRole = String(currentUser?.role || "")
    .trim()
    .toLowerCase();

  const isEmployee = currentRole === "employee";
  const isAdmin = currentRole === "admin";

  const [readAlertIds, setReadAlertIds] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(notificationStorageKey) || "[]"
      );

      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Save read alert IDs
  useEffect(() => {
    localStorage.setItem(
      notificationStorageKey,
      JSON.stringify(readAlertIds)
    );
  }, [readAlertIds]);

  // Load notifications
  const loadNotifications = async () => {
    if (!token) return;

    try {
      await fetch("http://localhost:5001/api/notifications/check-sla", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const response = await fetch(
        "http://localhost:5001/api/notifications",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(await response.json());
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  useEffect(() => {
    loadNotifications();

    const timer = setInterval(loadNotifications, 60000);

    return () => clearInterval(timer);
  }, [currentUser?.id]);

  const unreadNotifications = notifications.filter(
    (n) => !Number(n.is_read)
  );

  // Admin notification filtering
  const bellNotifications = isAdmin
    ? notifications.filter((n) =>
        ["critical_ticket", "sla_approaching"].includes(
          String(n.type).toLowerCase()
        )
      )
    : notifications;

  const bellUnreadNotifications = bellNotifications.filter(
    (n) => !Number(n.is_read)
  );

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await fetch(
        "http://localhost:5001/api/notifications/read-all",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((current) =>
        current.map((n) => ({ ...n, is_read: 1 }))
      );
    } catch (error) {
      console.error(error);
    }
  };

  // Mark one notification as read
  const markNotificationRead = async (id) => {
    try {
      await fetch(
        `http://localhost:5001/api/notifications/${id}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((current) =>
        current.map((n) =>
          n.id === id ? { ...n, is_read: 1 } : n
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  // Admin: remind all tickets
  const remindAllTickets = async () => {
    try {
      const response = await fetch(
        "http://localhost:5001/api/notifications/remind-all",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send reminders."
        );
      }

      await loadNotifications();

      alert(`${data.created} IT Staff reminders created.`);
    } catch (error) {
      console.error("Failed to send reminders:", error);
      alert(error.message);
    }
  };

  // User profile information
  const userName = currentUser?.name || "User";

  const userRole = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() +
      currentUser.role.slice(1)
    : "Employee";

  const initials = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Filter urgent tickets for notification alerts
  const urgentTickets = tickets.filter((ticket) => {
    if (
      !ticket.sla_deadline ||
      ticket.status === "Resolved" ||
      ticket.status === "Closed"
    ) {
      return false;
    }

    const deadline = parseDate(ticket.sla_deadline);

    if (!deadline) return false;

    const remainingHours =
      (deadline - new Date()) / (1000 * 60 * 60);

    return remainingHours <= 2;
  });

  const unreadTickets = urgentTickets.filter(
    (ticket) => !readAlertIds.includes(String(ticket.id))
  );

  // Sidebar navigation based on role
  const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        {
          path: "/",
          label: "Dashboard",
          icon: LayoutDashboard,
        },
        {
          path: "/tickets",
          label: "Tickets",
          icon: Ticket,
        },
        ...(["employee", "it_staff", "admin"].includes(currentRole)
          ? [
              {
                path: "/notifications",
                label: "Notifications",
                icon: Bell,
              },
            ]
          : []),
      ],
    },
    {
      title: "KNOWLEDGE & SUPPORT",
      items: [
        {
          path: "/knowledge-base",
          label: "Knowledge Base",
          icon: BookOpen,
        },
        ...(!isEmployee
          ? [
              {
                path: "/sla",
                label: "SLA Management",
                icon: Clock3,
              },
            ]
          : []),
      ],
    },
    ...(!isEmployee
      ? [
          {
            title: "INSIGHTS",
            items: [
              {
                path: "/analytics",
                label: "Analytics",
                icon: BarChart3,
              },
              {
                path: "/reports",
                label: "Reports",
                icon: FileText,
              },
            ],
          },
        ]
      : []),
    {
      title: "ADMINISTRATION",
      items: [
        {
          path: "/users",
          label: "Users",
          icon: Users,
        },
        {
          path: "/settings",
          label: "Settings",
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <div className="app">
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}
      >
        <div className="brand">
          <div className="brand-icon">
            <img
              src="/logo-headset-shield.png"
              alt="IT ServiceHub Logo"
            />
          </div>

          <div>
            <h2>IT ServiceHub</h2>
            <span>Help Desk & SLA Analytics</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <h4 className="nav-group-title">
                {group.title}
              </h4>

              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? "active" : ""}`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials}</div>

          <div className="sidebar-user-info">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </div>

          <button
            onClick={onLogout}
            title="Logout"
            className="logout-btn"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="topbar-title">
            <h1>IT ServiceHub</h1>
            <p>IT Help Desk performance overview</p>
          </div>

          <div className="topbar-right">
            {/* Notification popover */}
            <div className="notification-wrapper">
              <button
                type="button"
                className={`notification-trigger ${
                  showNotifications ? "is-open" : ""
                }`}
                title="Notifications"
                aria-label={`Notifications, ${bellUnreadNotifications.length} unread`}
                aria-expanded={showNotifications}
                onClick={() =>
                  setShowNotifications((open) => !open)
                }
              >
                <Bell size={21} strokeWidth={2} />

                {bellUnreadNotifications.length > 0 && (
                  <span className="notification-count">
                    {bellUnreadNotifications.length > 99
                      ? "99+"
                      : bellUnreadNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <button
                    type="button"
                    className="notification-backdrop"
                    aria-label="Close notifications"
                    onClick={() => setShowNotifications(false)}
                  />

                  <div className="notification-dropdown">
                    <div className="notification-header">
                      {isAdmin && (
                        <button
                          type="button"
                          className="notification-read-all"
                          onClick={remindAllTickets}
                        >
                          Remind All Tickets
                        </button>
                      )}

                      <div>
                        <strong>Notifications</strong>
                        <span>
                          {bellUnreadNotifications.length
                            ? `${bellUnreadNotifications.length} unread`
                            : "You're all caught up"}
                        </span>
                      </div>
                    </div>

                    <div className="notification-list">
                      {bellNotifications.length === 0 ? (
                        <div className="notification-empty">
                          <span className="notification-empty-icon">
                            <Bell size={24} />
                          </span>

                          <strong>No notifications yet</strong>

                          <p>
                            Ticket updates and SLA reminders will
                            appear here.
                          </p>
                        </div>
                      ) : (
                        bellNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="notification-row"
                          >
                            <Link
                              to={
                                notification.ticket_id
                                  ? `/tickets/${notification.ticket_id}`
                                  : "/knowledge-base"
                              }
                              className={`notification-item ${
                                !Number(notification.is_read)
                                  ? "is-unread"
                                  : ""
                              }`}
                              onClick={() => {
                                if (!Number(notification.is_read)) {
                                  markNotificationRead(notification.id);
                                }

                                setShowNotifications(false);
                              }}
                            >
                              <span className="notification-item-icon">
                                {notification.type === "sla_approaching" ? (
                                  <AlertTriangle size={17} />
                                ) : (
                                  <Bell size={17} />
                                )}
                              </span>

                              <span className="notification-item-content">
                                <span className="notification-item-title">
                                  {notification.title}
                                </span>

                                <span className="notification-item-description">
                                  {notification.message}
                                </span>

                                <span className="notification-item-meta">
                                  {notification.ticket_number
                                    ? `${notification.ticket_number} · `
                                    : ""}

                                  {notification.created_at
                                    ? new Date(
                                        String(notification.created_at)
                                          .replace(" ", "T") +
                                          (String(
                                            notification.created_at
                                          ).includes("Z")
                                            ? ""
                                            : "Z")
                                      ).toLocaleString()
                                    : ""}
                                </span>
                              </span>

                              {!Number(notification.is_read) && (
                                <span className="notification-unread-dot" />
                              )}
                            </Link>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="notification-footer">
                      <span>IT ServiceHub</span>
                      <span>Ticket notifications</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="profile">
              <div className="avatar">{initials}</div>

              <div className="profile-info">
                <strong>{userName}</strong>
                <span>{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          <Routes>
            <Route
              path="/"
              element={<Dashboard tickets={tickets} />}
            />

            <Route
              path="/tickets"
              element={
                <Tickets
                  tickets={tickets}
                  setTickets={setTickets}
                  onDelete={onDelete}
                  isAdmin={isAdmin}
                />
              }
            />

            <Route
              path="/tickets/new"
              element={
                <CreateTicket
                  setTickets={setTickets}
                  currentUser={currentUser}
                />
              }
            />

            <Route
              path="/tickets/:id"
              element={
                <TicketDetails
                  tickets={tickets}
                  setTickets={setTickets}
                  currentUser={currentUser}
                />
              }
            />

            <Route
              path="/notifications"
              element={
                <NotificationsPage
                  notifications={notifications}
                  markNotificationRead={markNotificationRead}
                  markAllNotificationsRead={markAllNotificationsRead}
                />
              }
            />

            <Route
              path="/knowledge-base"
              element={<KnowledgeBase />}
            />

            <Route
              path="/sla"
              element={
                isEmployee ? (
                  <div className="access-denied">
                    You do not have permission to access this page.
                  </div>
                ) : (
                  <SLAManagement tickets={tickets} />
                )
              }
            />

            <Route
              path="/analytics"
              element={
                isEmployee ? (
                  <div className="access-denied">
                    You do not have permission to access this page.
                  </div>
                ) : (
                  <Analytics tickets={tickets} />
                )
              }
            />

            <Route
              path="/users"
              element={<UsersPage currentUser={currentUser} />}
            />

            <Route
              path="/reports"
              element={
                isEmployee ? (
                  <div className="access-denied">
                    You do not have permission to access this page.
                  </div>
                ) : (
                  <Reports tickets={tickets} />
                )
              }
            />

            <Route
              path="/settings"
              element={<SettingsPage />}
            />
          </Routes>
        </section>
      </main>
    </div>
  );
}



function NotificationsPage({
  notifications,
  markNotificationRead,
  markAllNotificationsRead,
}) {
  const unreadCount = notifications.filter(
    (n) => !Number(n.is_read)
  ).length;

  return (
    <div className="page notification-page">
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <p>Updates on tickets you created.</p>
        </div>

        <div className="notification-page-actions">
          <span className="notification-page-count">
            {unreadCount} unread
          </span>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
            >
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      <div className="notification-page-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <Bell size={28} />
            <h3>No notifications yet</h3>
            <p>Updates about tickets you created will appear here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-page-item ${
                Number(notification.is_read) ? "is-read" : "is-unread"
              }`}
            >
              <div className="notification-page-icon">
                {notification.type === "sla_approaching" ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Bell size={20} />
                )}
              </div>

              <div className="notification-page-content">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>

                <small>
                  {notification.ticket_number || ""}
                  {notification.ticket_number ? " · " : ""}
                  {notification.created_at
                    ? new Date(
                        String(notification.created_at).replace(" ", "T") + "Z"
                      ).toLocaleString()
                    : ""}
                </small>

                {notification.ticket_id && (
                  <Link to={`/tickets/${notification.ticket_id}`}>
                    View ticket
                  </Link>
                )}
              </div>

              {!Number(notification.is_read) && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(notification.id)}
                >
                  Mark as read
                </button>
              )}

              {Number(notification.is_read) === 1 && (
                <span className="notification-read-label">
                  <CheckCircle2 size={16} /> Read
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


/* =========================
   DASHBOARD
========================= */

// ==========================================
// SHARED SLA CALCULATION
// Used by Dashboard and Analytics
// ==========================================

const getSlaCategory = (ticket) => {

  const status = String(ticket.sla_status || "").trim();

  const normalized = status.toLowerCase();

  if (
    ["met / succeeded", "met", "succeeded"].includes(normalized)
  ) {
    return "Met";
  }

  if (
    [
      "in progress / running",
      "within sla",
      "running",
      "active",
    ].includes(normalized)
  ) {
    return "Within SLA";
  }

  if (
    [
      "warning / at risk",
      "at risk",
      "warning",
    ].includes(normalized)
  ) {
    return "At Risk";
  }

  if (
    [
      "breached / violated",
      "breached",
      "violated",
    ].includes(normalized)
  ) {
    return "Breached";
  }

  if (
    [
      "cancelled / detached",
      "cancelled",
      "canceled",
      "detached",
    ].includes(normalized)
  ) {
    return "Cancelled";
  }

  if (
    [
      "paused / on hold",
      "paused",
      "on hold",
    ].includes(normalized)
  ) {
    return "Paused";
  }

  return "Unknown";
};

// Support the possible API deadline field names.
const hasSlaDeadline = (ticket) =>
  Boolean(
    ticket.sla_deadline ||
    ticket.due_date ||
    ticket.sla_due_date
  );

// Shared metrics for both pages.
const calculateTicketMetrics = (tickets = []) => {
  const ticketsWithSLA = tickets.filter(hasSlaDeadline); 
  const ticketsWithoutSLA = tickets.filter(
  (ticket) => !hasSlaDeadline(ticket)
);

  const slaCounts = {
    within: 0,
    risk: 0,
    breached: 0,
    met: 0,
    cancelled: 0,
    paused: 0,
    unknown: 0,
  };

  ticketsWithSLA.forEach((ticket) => {
    const category = getSlaCategory(ticket);

    if (category === "Within SLA") slaCounts.within++;
    else if (category === "At Risk") slaCounts.risk++;
    else if (category === "Breached") slaCounts.breached++;
    else if (category === "Met") slaCounts.met++;
    else if (category === "Cancelled") slaCounts.cancelled++;
    else if (category === "Paused") slaCounts.paused++;
    else slaCounts.unknown++;
  });

  // Only resolved or closed tickets count toward SLA compliance.
  const completedSLATickets = ticketsWithSLA.filter((ticket) => {
    const status = String(ticket.status || "").toLowerCase();
    const category = getSlaCategory(ticket);

    return (
      (status === "resolved" || status === "closed") &&
      (category === "Met" || category === "Breached")
    );
  });

  const completedMetTickets = completedSLATickets.filter(
    (ticket) => getSlaCategory(ticket) === "Met"
  );

  const slaCompliance =
    completedSLATickets.length > 0
      ? (
          (completedMetTickets.length / completedSLATickets.length) * 100
        ).toFixed(1)
      : "0.0";

  return {
    ticketsWithSLA,
    ticketsWithoutSLA,
    slaCounts,
    completedSLATickets,
    slaCompliance,
  };
};


function Dashboard({ tickets = [] }) {
  const totalTickets = tickets.length;

  const openTickets = tickets.filter(
    (ticket) => ticket.status === "Open" || ticket.status === "In Progress"
  ).length;

  const resolvedTickets = tickets.filter(
    (ticket) => ticket.status === "Resolved" || ticket.status === "Closed"
  ).length;


const {
  ticketsWithSLA,
  ticketsWithoutSLA,
  slaCounts,
  completedSLATickets,
  slaCompliance,
} = calculateTicketMetrics(tickets);
const successfulSLATickets = completedSLATickets.filter(
  (ticket) => getSlaCategory(ticket) === "Met"
);

  const priorityCounts = {
    Critical: tickets.filter((ticket) => ticket.priority === "Critical").length,
    High: tickets.filter((ticket) => ticket.priority === "High").length,
    Medium: tickets.filter((ticket) => ticket.priority === "Medium").length,
    Low: tickets.filter((ticket) => ticket.priority === "Low").length,
  };

  const maxPriorityCount = Math.max(...Object.values(priorityCounts), 1);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });

  const monthlyTickets = months.map((month) => {
    return tickets.filter((ticket) => {
      const createdDate = ticket.created_at ? new Date(ticket.created_at) : null;
      if (!createdDate || isNaN(createdDate)) return false;
      return (
        createdDate.getFullYear() === month.year &&
        createdDate.getMonth() === month.month
      );
    }).length;
  });

  const maxMonthlyTickets = Math.max(...monthlyTickets, 1);

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Monitor your IT service performance</p>
        </div>
      </div>

      <div className="stats-grid dashboard-bento">
        <div className="stat-card stat-card-total">
          <div className="stat-card-top">
            <span className="stat-label">Total Tickets</span>
            <span className="stat-icon"><Ticket size={21} /></span>
          </div>
          <strong className="stat-value">{totalTickets}</strong>
          <small className="stat-sub">All support requests</small>
        </div>

        <div className="stat-card stat-card-open">
          <div className="stat-card-top">
            <span className="stat-label">Open Tickets</span>
            <span className="stat-icon"><Clock3 size={21} /></span>
          </div>
          <strong className="stat-value">{openTickets}</strong>
          <small className="stat-sub">Awaiting resolution</small>
        </div>

        <div className="stat-card stat-card-resolved">
          <div className="stat-card-top">
            <span className="stat-label">Resolved Tickets</span>
            <span className="stat-icon"><CheckCircle2 size={21} /></span>
          </div>
          <strong className="stat-value">{resolvedTickets}</strong>
          <small className="stat-sub">Successfully completed</small>
        </div>

        <div className="stat-card stat-card-sla">
          <div className="stat-card-top">
            <span className="stat-label">SLA Compliance</span>
            <span className="stat-icon"><ShieldCheck size={21} /></span>
          </div>
          <strong className="stat-value">{slaCompliance}%</strong>
          <small className="stat-sub">{ticketsWithSLA.length} tickets with SLA</small>
        </div>
      </div>

      <div className="dashboard-chart-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Ticket Trends</h3>
              <p>Monthly ticket volume</p>
            </div>
            <span className="chart-label">Last 6 months</span>
          </div>

          <div className="bar-chart">
            {monthlyTickets.map((count, index) => (
              <div
                className="bar-column"
                key={`${months[index].year}-${months[index].month}`}
              >
                <div className="bar-value">{count}</div>
                <div
                  className="bar"
                  style={{
                    height: `${Math.max(
                      (count / maxMonthlyTickets) * 160,
                      count > 0 ? 16 : 4
                    )}px`,
                  }}
                />
                <span className="bar-label">{months[index].label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Tickets by Priority</h3>
              <p>Current distribution</p>
            </div>
          </div>

          <div className="priority-chart">
            {Object.entries(priorityCounts).map(([priority, count]) => (
              <div className="priority-row" key={priority}>
                <div className="priority-row-header">
                  <span className="priority-name">{priority}</span>
                  <strong className="priority-count">{count}</strong>
                </div>

                <div className="priority-track">
                  <div
                    className="priority-fill"
                    style={{
                      width: `${(count / maxPriorityCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>SLA Overview</h3>
            <p>Current SLA performance</p>
          </div>
        </div>

        {/* Updated to use slaCounts object */}
<div className="sla-summary-grid">
  <div className="sla-summary-card sla-summary-within">
    <span className="sla-summary-icon"><CheckCircle2 size={19} /></span>
    <div>
      <span>Within SLA</span>
      <strong>{slaCounts.within}</strong>
    </div>
  </div>

  <div className="sla-summary-card sla-summary-risk">
    <span className="sla-summary-icon"><Clock3 size={19} /></span>
    <div>
      <span>At Risk</span>
      <strong>{slaCounts.risk}</strong>
    </div>
  </div>

  <div className="sla-summary-card sla-summary-met">
    <span className="sla-summary-icon"><CheckCircle2 size={19} /></span>
    <div>
      <span>Met</span>
      <strong>{slaCounts.met}</strong>
    </div>
  </div>

  <div className="sla-summary-card sla-summary-breached">
    <span className="sla-summary-icon"><AlertTriangle size={19} /></span>
    <div>
      <span>Breached</span>
      <strong>{slaCounts.breached}</strong>
    </div>
  </div>

  <div className="sla-summary-card sla-summary-paused">
    <span className="sla-summary-icon"><Circle size={19} /></span>
    <div>
      <span>Paused / Cancelled</span>
      <strong>{slaCounts.paused + slaCounts.cancelled}</strong>
    </div>
  </div>
</div>
      </section>
    </>
  );
}

/* =========================
   TICKETS
========================= */

function Tickets({ tickets, onDelete, isAdmin }) {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [status, setStatus] = useState("All");

  const filteredTickets = tickets.filter((ticket) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      String(ticket.ticket_number || ticket.id || "")
        .toLowerCase()
        .includes(searchText) ||
      String(ticket.title || "")
        .toLowerCase()
        .includes(searchText) ||
      String(ticket.requester_name || ticket.requester || "")
        .toLowerCase()
        .includes(searchText);

    const matchesPriority =
      priority === "All" || ticket.priority === priority;

    const matchesStatus = status === "All" || ticket.status === status;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Tickets</h2>
          <p>Manage and track IT support requests</p>
        </div>

        <Link to="/tickets/new" className="primary-btn">
          <Plus size={18} />
          Create Ticket
        </Link>
      </div>

      <section className="panel">
        <div className="ticket-toolbar">
 <div className="search-box">
  <input
    type="text"
    placeholder="Search tickets..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
  <Search size={18} className="search-icon" />
</div>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option>All</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All</option>
            <option>Open</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
        </div>

        <TicketTable
          tickets={filteredTickets}
          showActions
          onDelete={onDelete}
          isAdmin={isAdmin}
        />

        {filteredTickets.length === 0 && (
          <div className="empty-state">
            <Ticket size={40} />
            <h3>No tickets found</h3>
            <p>Try changing your search or filters.</p>
          </div>
        )}
      </section>
    </>
  );
}

/* =========================
   TICKET DETAILS (ROLE-BASED PERMISSIONS)
========================= */




export function TicketDetails({ tickets, setTickets, currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  // Comments
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentError, setCommentError] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState([]);

  // Assignment
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  // Ticket status
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  // Current ticket
  const ticket = tickets.find(
    (t) =>
      String(t.id) === String(id) ||
      String(t.ticket_number) === String(id)
  );

  // User permissions
  const userRole = currentUser?.role?.toLowerCase() || "employee";
  const isAdmin = userRole === "admin";

  const isITStaff = ["it_staff", "it", "staff"].includes(userRole);

  const isAssignedStaff =
    isITStaff &&
    ticket?.assigned_to != null &&
    currentUser?.id != null &&
    String(ticket.assigned_to) === String(currentUser.id);

  const canMarkAsDone = isAdmin || isAssignedStaff;

  // Load ticket attachments
  useEffect(() => {
    let cancelled = false;

    const loadAttachments = async () => {
      try {
        const token = localStorage.getItem("token");

        const response = await fetch(
          `http://localhost:5001/api/tickets/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load attachments.");
        }

        if (!cancelled) {
          setAttachments(
            Array.isArray(data.attachments) ? data.attachments : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load attachments:", error);
        }
      }
    };

    loadAttachments();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load saved comments
  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentError("");

      try {
        const token = localStorage.getItem("token");

        const response = await fetch(
          `http://localhost:5001/api/comments/ticket/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load ticket comments.");
        }

        if (!cancelled) {
          setComments(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommentError(error.message);
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load assignable users ONLY for Admin
  useEffect(() => {
    let cancelled = false;

    const loadAssignableUsers = async () => {
      if (!isAdmin) {
        setAssignableUsers([]);
        setSelectedAssignee("");
        setLoadingAssignees(false);
        return;
      }

      try {
        setLoadingAssignees(true);
        setAssignmentError("");

        const token = localStorage.getItem("token");

        const response = await fetch(
          "http://localhost:5001/api/users",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load users.");
        }

        const users = Array.isArray(data)
          ? data
          : Array.isArray(data.users)
            ? data.users
            : [];

        // Only Admin and IT Staff can be assigned tickets
        const filteredUsers = users.filter((user) =>
          ["admin", "it_staff", "it", "staff"].includes(
            user.role?.toLowerCase()
          )
        );

        if (!cancelled) {
          setAssignableUsers(filteredUsers);
        }
      } catch (error) {
        if (!cancelled) {
          setAssignmentError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignees(false);
        }
      }
    };

    loadAssignableUsers();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Keep selected assignee synchronized with the ticket
  useEffect(() => {
    if (ticket) {
      setSelectedAssignee(
        ticket.assigned_to != null
          ? String(ticket.assigned_to)
          : ""
      );
    }
  }, [ticket?.id, ticket?.assigned_to]);

  // Add a comment
  const handleAddComment = async (e) => {
    e.preventDefault();

    const text = commentText.trim();

    if (!text || postingComment) return;

    setPostingComment(true);
    setCommentError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/comments/ticket/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment: text }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to post comment.");
      }

      if (!data.comment) {
        throw new Error(
          "The comment was saved, but no comment data was returned."
        );
      }

      setComments((previous) => [...previous, data.comment]);
      setCommentText("");
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setPostingComment(false);
    }
  };

  // Assign or reassign a ticket - Admin ONLY
  const handleSaveAssignment = async () => {
    if (!isAdmin || !ticket || savingAssignment) return;

    try {
      setSavingAssignment(true);
      setAssignmentError("");
      setAssignmentMessage("");

      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/tickets/${ticket.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            assigned_to: selectedAssignee
              ? Number(selectedAssignee)
              : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to assign ticket.");
      }

      if (!data.ticket) {
        throw new Error(
          "The server did not return the updated ticket."
        );
      }

      const updatedTicket = data.ticket;

      setTickets((previous) =>
        previous.map((item) =>
          String(item.id) === String(updatedTicket.id)
            ? { ...item, ...updatedTicket }
            : item
        )
      );

      setAssignmentMessage("Assignment saved successfully.");
    } catch (error) {
      setAssignmentError(error.message);
    } finally {
      setSavingAssignment(false);
    }
  };


// Update ticket status
  const handleStatusChange = async (newStatus) => {
    if (!ticket || savingStatus) return;

    const canUpdateStatus = isAdmin || isAssignedStaff;

    if (!canUpdateStatus) return;

    try {
      setSavingStatus(true);
      setStatusError("");

      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/tickets/${ticket.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update ticket status.");
      }

      if (!data.ticket) {
        throw new Error("Updated ticket data was not returned.");
      }

      const updatedTicket = data.ticket;

      setTickets((previous) =>
        previous.map((item) =>
          String(item.id) === String(updatedTicket.id)
            ? { ...item, ...updatedTicket }
            : item
        )
      );
    } catch (error) {
      setStatusError(error.message);
    } finally {
      setSavingStatus(false);
    }
  };


  // Ticket not found
  if (!ticket) {
    return (
      <div className="panel ticket-not-found">
        <h3>
          Ticket not found
        </h3>

        <button
          className="secondary-btn"
          onClick={() => navigate("/tickets")}
        >
          <ArrowLeft size={16} />
          Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="ticket-details-page">
      <div className="ticket-details-shell">

        {/* Ticket Header */}
        <div className="ticket-page-header">
          <div className="ticket-header-info">
            <div className="ticket-header-topline">
              <h2 className="ticket-header-number">
                Ticket #{ticket.ticket_number || ticket.id}
              </h2>

              <span
                className={`ticket-header-status ${
                  ticket.status === "Resolved" ||
                  ticket.status === "Closed"
                    ? "is-resolved"
                    : "is-open"
                }`}
              >
                {ticket.status}
              </span>
            </div>

            <p className="ticket-header-title">{ticket.title}</p>
          </div>

          <div className="ticket-header-actions">

        {(isAdmin || isAssignedStaff) && (
          <select
            className="ticket-status-select"
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={savingStatus}
            aria-label="Update ticket status"
          >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>

            {isAdmin && (
              <option value="Closed">Closed</option>
            )}
          </select>
        )}


            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="ticket-header-back"
            >
              <ArrowLeft size={16} />
              Back to Tickets
            </button>
          </div>
        </div>

        {statusError && (
          <p role="alert" className="error-text">
            {statusError}
          </p>
        )}

        {/* Description */}
        <div className="ticket-content-card ticket-description-card">
          <h3 className="ticket-section-title">
            <span className="ticket-section-icon ticket-icon-blue">
              <FileText size={18} />
            </span>
            Description
          </h3>

          <p className="ticket-description-text">
            {ticket.description || "No description provided."}
          </p>
        </div>

        {/* Attachments */}
        <div className="ticket-content-card ticket-attachments-card">
          <h3 className="ticket-section-title">
            <span className="ticket-section-icon ticket-icon-blue">
              <FileText size={18} />
            </span>
            Attachments ({attachments.length})
          </h3>

          {attachments.length === 0 ? (
            <p className="muted-text">
              No attachments available.
            </p>
          ) : (
            <div className="attachment-grid">
              {attachments.map((file) => {
                const fileUrl = `http://localhost:5001${file.file_path}`;
                const isImage = file.mime_type?.startsWith("image/");
                const isVideo = file.mime_type?.startsWith("video/");

                return (
                  <div key={file.id} className="attachment-tile">
                    {isImage ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={fileUrl}
                          alt={file.original_name}
                          className="attachment-media"
                        />
                      </a>
                    ) : isVideo ? (
                      <video controls className="attachment-media">
                        <source
                          src={fileUrl}
                          type={file.mime_type}
                        />
                      </video>
                    ) : (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="attachment-link"
                      >
                        View or download file
                      </a>
                    )}

                    <p
                      className="attachment-name"
                    >
                      {file.original_name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="ticket-details-grid">

          {/* Left Column: Discussion */}
          <div className="ticket-discussion-column">
            <div className="ticket-content-card ticket-discussion-card">
              <div className="discussion-header">
                <div className="discussion-heading">
                  <span className="ticket-section-icon ticket-icon-violet">
                    <Send size={18} />
                  </span>

                  <div>
                    <h3 className="ticket-section-title">
                      Discussion &amp; Updates
                    </h3>
                    <p className="discussion-subtitle">
                      Share updates and collaborate on this ticket
                    </p>
                  </div>
                </div>

                <span className="discussion-count">
                  {comments.length}{" "}
                  {comments.length === 1 ? "comment" : "comments"}
                </span>
              </div>

              {/* Comments */}
              <div className="discussion-thread">
                {commentsLoading ? (
                  <div className="discussion-loading">
                    <span className="discussion-spinner" />
                    <span>Loading discussion...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="ticket-empty-comments">
                    <span className="ticket-empty-icon">
                      <Send size={19} />
                    </span>

                    <div>
                      <p className="discussion-empty-title">
                        No updates yet
                      </p>
                      <p className="discussion-empty-description">
                        Start the conversation by posting the first comment.
                      </p>
                    </div>
                  </div>
                ) : (
                  comments.map((c) => (
                    <article key={c.id} className="ticket-comment-card">
                      <div
                        className={`comment-avatar comment-color-${
                          String(c.user_name || "User")
                            .split("")
                            .reduce(
                              (sum, char) => sum + char.charCodeAt(0),
                              0
                            ) % 6
                        }`}
                      >
                        {(c.user_name || "U")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="comment-content">
                        <div className="comment-header">
                          <div className="comment-author-info">
                            <span className="comment-author">
                              {c.user_name || "User"}
                            </span>

                            <span className="comment-role">
                              {(c.user_role || "employee")
                                .replace(/_/g, " ")
                                .toUpperCase()}
                            </span>
                          </div>

                          <time className="comment-timestamp">
                            {c.created_at || ""}
                          </time>
                        </div>

                        <p className="comment-message">{c.comment}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              {/* Comment Error */}
              {commentError && (
                <p role="alert" className="discussion-error">
                  <AlertTriangle size={16} />
                  {commentError}
                </p>
              )}

              {/* Add Comment */}
              <form
                onSubmit={handleAddComment}
                className="discussion-form"
              >
                <label
                  htmlFor="ticket-comment-input"
                  className="discussion-input-label"
                >
                  Add a comment
                </label>

                <textarea
                  id="ticket-comment-input"
                  rows={4}
                  placeholder={`Write a comment as ${userRole.toUpperCase()}...`}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={5000}
                  required
                  disabled={postingComment}
                  className="discussion-textarea"
                />

                <div className="discussion-form-footer">
                  <span className="discussion-character-count">
                    {commentText.length}/5000 characters
                  </span>

                  <button
                    type="submit"
                    disabled={postingComment || !commentText.trim()}
                    className="discussion-post-button"
                  >
                    {postingComment ? (
                      <>
                        <span className="discussion-button-spinner" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Post Comment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Ticket Details */}
          <div className="ticket-details-sidebar">
            <div className="ticket-info-card ticket-details-card">
              <h3 className="ticket-section-title">
                <span className="ticket-section-icon ticket-icon-indigo">
                  <Ticket size={18} />
                </span>
                Details
              </h3>

              <div className="ticket-meta-list">

                {/* Status */}
                <div className="ticket-meta-row">
                  <span className="ticket-meta-label">
                    <CheckCircle2 size={15} />
                    Status
                  </span>

                  <span className={`status-pill status-${String(ticket.status || "unknown").toLowerCase().trim().replace(/\s+/g, "-")}`}>
                    <span className="status-dot" />
                    {ticket.status}
                  </span>
                </div>

                {/* Priority */}
                <div className="ticket-meta-row">
                  <span className="ticket-meta-label">
                    <AlertTriangle size={15} />
                    Priority
                  </span>

                  <span
                    className={`badge ${ticket.priority?.toLowerCase()}`}
                  >
                    {ticket.priority}
                  </span>
                </div>

                {/* Category */}
                <div className="ticket-meta-row">
                  <span className="ticket-meta-label">
                    <FileText size={15} />
                    Category
                  </span>

                  <span className="ticket-meta-value">
                    {ticket.category || "General"}
                  </span>
                </div>

                {/* Requester */}
                <div className="ticket-meta-row">
                  <span className="ticket-meta-label">
                    <Users size={15} />
                    Requester
                  </span>

                  <span className="ticket-meta-value">
                    {ticket.requester_name ||
                      ticket.requester ||
                      "Unknown"}
                  </span>
                </div>

                {/* Assigned To */}
                <div className="ticket-meta-row ticket-assignment-row">
  <div className="ticket-assignment-inline">
  <span className="ticket-meta-label ticket-assignment-label">
    <Users size={18} />
    <span>Assigned To</span>
  </span>

  {isAdmin ? (
    <select
      value={selectedAssignee}
      onChange={(e) => {
        setSelectedAssignee(e.target.value);
        setAssignmentError("");
        setAssignmentMessage("");
      }}
      disabled={loadingAssignees || savingAssignment}
      className="ticket-assignment-select"
    >
      <option value="">Unassigned</option>

      {assignableUsers.map((user) => (
        <option key={user.id} value={String(user.id)}>
          {user.name} (
          {user.role?.toLowerCase() === "admin"
            ? "Admin"
            : "IT Staff"}
          )
        </option>
      ))}
    </select>
  ) : (
    <span className="ticket-assigned-name">
      {ticket.assigned_to_name ||
        ticket.assignedTo ||
        "Unassigned"}
    </span>
  )}
</div>

                  {/* Only Admin can save assignments */}
                  {isAdmin && (
                    <>
                      {loadingAssignees && (
                        <p className="muted-text">
                          Loading users...
                        </p>
                      )}

                      <div className="ticket-assignment-button-wrap">
                        <button
                          type="button"
                          onClick={handleSaveAssignment}
                          disabled={
                            loadingAssignees || savingAssignment
                          }
                          className="ticket-assignment-save"
                        >
                          {savingAssignment
                            ? "Saving..."
                            : "Save Assignment"}
                        </button>
                      </div>

                      {assignmentError && (
                        <p
                          role="alert"
                          className="error-text"
                        >
                          {assignmentError}
                        </p>
                      )}

                      {assignmentMessage && (
                        <p className="success-text">
                          {assignmentMessage}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* SLA Status */}
                <div className="ticket-meta-row ticket-sla-row">
                  <span className="ticket-meta-label">
                    <ShieldCheck size={15} />
                    SLA Status
                  </span>

                  <span className="meta-pill">
                    {ticket.sla_status || "Unknown"}
                  </span>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}




function TicketTable({
  tickets,
  showActions = false,
  onDelete,
  isAdmin = false,
}) {
  const navigate = useNavigate();

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Requester</th>
            {showActions && <th className="actions-cell">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id || ticket.ticket_number}>
              <td>{ticket.ticket_number || ticket.id}</td>
              <td>{ticket.title}</td>
              <td>
                <span className={`badge ${ticket.priority?.toLowerCase()}`}>
                  {ticket.priority}
                </span>
              </td>
 
<td>
  {(() => {
    const rawStatus = ticket.status || "Unknown";
    const status = rawStatus.toLowerCase().trim().replace(/\s+/g, "-");

    return (
      <span className={`status-pill status-${status}`}>
        <span className="status-dot" />
        {rawStatus}
      </span>
    );
  })()}
</td>

              <td>{ticket.requester_name || ticket.requester}</td>
 {showActions && (
  <td className="actions-cell">
    <div className="actions-wrapper">
      <button
        type="button"
        className="icon-btn"
        onClick={() =>
          navigate(`/tickets/${ticket.id || ticket.ticket_number}`)
        }
        title="View / Edit"
      >
        <Eye size={16} />
      </button>

      {isAdmin && (
        <button
          type="button"
          className="icon-btn text-danger"
          onClick={() => onDelete && onDelete(ticket)}
          title="Delete ticket"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  </td>
)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function PriorityBadge({ priority }) {
  const value = (priority || "Medium").toLowerCase();

  return (
    <span className={`ticket-label priority-${value}`}>
      <span className="ticket-label-dot" />
      {priority || "Medium"}
    </span>
  );
}


/* =========================
   CREATE TICKET
========================= */


function CreateTicket({ setTickets, currentUser }) {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedArticles, setSuggestedArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hardware",
    priority: "Medium",
    assignedTo: "",
  });

  // Load assignable users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);

        const response = await fetch(
          "http://localhost:5001/api/users"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load users.");
        }

        const assignableUsers = data.filter(
          (user) =>
            user.role === "it_staff" || user.role === "admin"
        );

        setUsers(assignableUsers);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (
      currentUser?.role === "admin" ||
      currentUser?.role === "it_staff"
    ) {
      loadUsers();
    } else {
      setLoadingUsers(false);
    }
  }, [currentUser]);

  // Handle form changes
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Handle attachment uploads
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    if (attachments.length + selectedFiles.length > 5) {
      setAttachmentError("You can upload a maximum of 5 files.");
      e.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    const invalidFile = selectedFiles.find(
      (file) => !allowedTypes.includes(file.type)
    );

    if (invalidFile) {
      setAttachmentError(
        "Only JPG, PNG, GIF, WEBP, MP4, WEBM, and MOV files are allowed."
      );
      e.target.value = "";
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > 50 * 1024 * 1024
    );

    if (oversizedFile) {
      setAttachmentError("Each file must be smaller than 50 MB.");
      e.target.value = "";
      return;
    }

    setAttachments((current) => [...current, ...selectedFiles]);
    setAttachmentError("");
    e.target.value = "";
  };

  // Search Knowledge Base articles
  useEffect(() => {
    const searchArticles = async () => {
      const searchText =
        `${form.title} ${form.description}`.trim();

      if (searchText.length < 3) {
        setSuggestedArticles([]);
        setLoadingArticles(false);
        return;
      }

      try {
        setLoadingArticles(true);

        const params = new URLSearchParams();
        params.set("q", searchText);

        const response = await fetch(
          `http://localhost:5001/api/knowledge-base?${params}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to search articles."
          );
        }

        setSuggestedArticles(
          Array.isArray(data) ? data.slice(0, 3) : []
        );
      } catch (error) {
        console.error("Article search failed:", error);
        setSuggestedArticles([]);
      } finally {
        setLoadingArticles(false);
      }
    };

    const timer = setTimeout(searchArticles, 400);

    return () => clearTimeout(timer);
  }, [form.title, form.description]);

  // Submit ticket
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      alert("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const ticketData = new FormData();

      ticketData.append("title", form.title.trim());
      ticketData.append("description", form.description.trim());
      ticketData.append("category", form.category);
      ticketData.append("priority", form.priority);
      ticketData.append("requester_id", currentUser?.id || "");

      ticketData.append(
        "assigned_to",
        form.assignedTo ? Number(form.assignedTo) : ""
      );

      attachments.forEach((file) => {
        ticketData.append("attachments", file);
      });

      const response = await fetch(
        "http://localhost:5001/api/tickets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: ticketData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create ticket."
        );
      }

      setTickets((current) => [
        data.ticket || data,
        ...current,
      ]);

      navigate("/tickets");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-heading create-ticket-heading">
        <div>
          <h2>Create Ticket</h2>
          <p>Create a new IT support request</p>
        </div>

        <Link to="/tickets" className="back-link">
          <ArrowLeft size={16} />
          Back to Tickets
        </Link>
      </div>

      <section className="panel form-panel">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">

            {/* Ticket Title */}
            <div className="form-group full">
              <label>Ticket Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter the problem title"
                required
                disabled={submitting}
              />
            </div>

            {/* Requester */}
            <div className="form-group compact-ticket-field">
              <label>Requester</label>
              <input
                value={currentUser?.name || "Employee"}
                disabled
              />
            </div>

            {/* Category */}
            <div className="form-group compact-ticket-field">
              <label>Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={submitting}
              >
                <option>Hardware</option>
                <option>Software</option>
                <option>Network</option>
                <option>Account</option>
                <option>Security</option>
                <option>Other</option>
              </select>
            </div>

            {/* Priority */}
            <div className="form-group compact-ticket-field">
              <label>Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                disabled={submitting}
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            {/* Assign To */}
            {(currentUser?.role === "admin" ||
              currentUser?.role === "it_staff") && (
              <div className="form-group">
                <label>Assign To</label>
               <select
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  disabled={submitting || loadingUsers}
                  className="assigned-to-select"
                >
                  <option value="">
                    {loadingUsers ? "Loading users..." : "Unassigned"}
                  </option>

                  {!loadingUsers &&
                    users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} (
                        {user.role === "it_staff" ? "IT Staff" : "Admin"})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div className="form-group full">
              <label>Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the problem in detail..."
                rows="7"
                required
                disabled={submitting}
              />
            </div>

            {/* Attachments */}
            <div className="form-group full">
              <label className="attachment-label">
                Attachments <span>(Optional)</span>
              </label>

              <div className="custom-upload-area">
                <input
                  id="ticket-attachments"
                  className="attachment-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileChange}
                  disabled={submitting || attachments.length >= 5}
                />

                <label
                  htmlFor="ticket-attachments"
                  className={`upload-dropzone ${
                    attachments.length >= 5 ? "upload-disabled" : ""
                  }`}
                >
                  <strong>Drag and drop files here</strong>
                  <span>or click to browse your files</span>
                  <span className="upload-browse-btn">
                    Browse Files
                  </span>
                  <small>JPG, PNG, GIF, WEBP, MP4, WEBM, MOV</small>
                  <small>Maximum 5 files · 50 MB per file</small>
                </label>
              </div>

              {attachmentError && (
                <p className="error-text">{attachmentError}</p>
              )}

              {attachments.length > 0 && (
                <div className="attachment-list">
                  <div className="attachment-list-header">
                    <strong>Selected files</strong>
                    <span>{attachments.length}/5 files</span>
                  </div>

                  {attachments.map((file, index) => (
                    <div
                      className="attachment-item"
                      key={`${file.name}-${index}`}
                    >
                      <div className="attachment-file-icon">
                        {file.type.startsWith("video/") ? (
                          <Film size={20} />
                        ) : (
                          <Image size={20} />
                        )}
                      </div>

                      <div className="attachment-file-info">
                        <strong>{file.name}</strong>
                        <small>
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </small>
                      </div>

                      <button
                        type="button"
                        className="attachment-remove-btn"
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((_, i) => i !== index)
                          )
                        }
                        disabled={submitting}
                        title="Remove file"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggested Knowledge Base Articles */}
            <div className="form-group full">
              <div className="suggested-articles">
                <h3>
                  <BookOpen size={18} />
                  Suggested Knowledge Base Articles
                </h3>

                {loadingArticles && (
                  <p>Searching for helpful articles...</p>
                )}

                {!loadingArticles &&
                  suggestedArticles.length === 0 && (
                    <p>
                      Enter a problem title or description to find helpful articles.
                    </p>
                  )}

                {!loadingArticles &&
                  suggestedArticles.map((article) => (
                    <div
                      className="suggested-article-card"
                      key={`${article.type || "local"}-${article.id}`}
                    >
                      <div>
                        <strong>{article.title}</strong>
                        <span>{article.category}</span>
                        <p>
                          {article.content?.slice(0, 120)}
                          {article.content?.length > 120 ? "..." : ""}
                        </p>
                      </div>

                      {(article.url || article.external_url) && (
                        <a
                          href={article.url || article.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Guide ↗
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <Link
              to="/tickets"
              className="secondary-btn cancel-btn"
              onClick={(event) => {
                if (submitting) event.preventDefault();
              }}
              aria-disabled={submitting}
            >
              Cancel
            </Link>

            <button
              className="primary-btn"
              type="submit"
              disabled={submitting}
            >
              <Plus size={18} />
              {submitting ? "Creating Ticket..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}


/* =========================
   SLA MANAGEMENT
========================= */

// =========================
// SLA STATUS HELPER
// =========================


function parseDatabaseDate(value) {
  if (!value) return null;

  const timestamp = String(value).trim().replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);

  const date = new Date(
    hasTimezone ? timestamp : `${timestamp}Z`
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSLAStatus(ticket) {
  const status = String(ticket.status || "").trim().toLowerCase();
  const deadline = ticket.sla_deadline;

  if (["cancelled", "canceled"].includes(status)) {
    return "Cancelled / Detached";
  }

  if (["on hold", "paused", "pending"].includes(status)) {
    return "Paused / On Hold";
  }

  const dueAt = parseDatabaseDate(deadline);

  if (["resolved", "closed", "completed"].includes(status)) {
    if (!deadline) return "Met / Succeeded";

    const resolvedAt = parseDatabaseDate(ticket.resolved_at);

    if (resolvedAt && dueAt && resolvedAt <= dueAt) {
      return "Met / Succeeded";
    }

    return "Breached / Violated";
  }

  if (!deadline) return "In Progress / Running";

  const createdAt = parseDatabaseDate(ticket.created_at);
  const now = new Date();

  if (!dueAt || !createdAt) {
    return "In Progress / Running";
  }

  const remaining = dueAt.getTime() - now.getTime();

  if (remaining <= 0) {
    return "Breached / Violated";
  }

  const totalDuration = dueAt.getTime() - createdAt.getTime();

  if (totalDuration > 0 && remaining / totalDuration <= 0.2) {
    return "Warning / At Risk";
  }

  return "In Progress / Running";
}



function SLAManagement({ tickets }) {
  const [, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const getSLAStatus = (ticket) => {
    const deadline = parseDate(ticket.sla_deadline);

    if (!deadline) return "Unknown";

    const status = (ticket.status || "").toLowerCase();

    if (["resolved", "closed", "completed"].includes(status)) {
      if (!ticket.resolved_at) {
        return "Completed";
      }

      const resolvedAt = parseDate(ticket.resolved_at);

      if (!resolvedAt) return "Completed";

      return resolvedAt <= deadline ? "Met SLA" : "Breached";
    }

    if (["on hold", "pending"].includes(status)) {
      return "On Hold";
    }

    const now = new Date();

    if (now >= deadline) return "Breached";

    const remainingHours = (deadline - now) / (1000 * 60 * 60);

    if (remainingHours <= 2) return "At Risk";

    return "Within SLA";
  };

  const formatRemainingTime = (deadlineStr, ticket) => {
    const status = (ticket.status || "").toLowerCase();

    if (["resolved", "closed", "completed"].includes(status)) {
      return "Completed";
    }

    if (["on hold", "pending"].includes(status)) {
      return "On hold";
    }

    const target = parseDate(deadlineStr);

    if (!target) return "N/A";

    const difference = target - new Date();

    if (difference <= 0) {
      const overdueMinutes = Math.floor(Math.abs(difference) / 60000);
      const overdueHours = Math.floor(overdueMinutes / 60);
      const minutes = overdueMinutes % 60;

      return `Overdue ${overdueHours}h ${minutes}m`;
    }

    const totalMinutes = Math.floor(difference / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours >= 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const allTickets = tickets || [];

  const activeTickets = allTickets.filter((ticket) => {
    const status = (ticket.status || "").toLowerCase();
    return !["resolved", "closed", "completed"].includes(status);
  });

  const ticketsWithSLA = allTickets.filter((ticket) => ticket.sla_deadline);

  const withinSLA = activeTickets.filter(
    (ticket) => getSLAStatus(ticket) === "Within SLA"
  );

  const atRisk = activeTickets.filter(
    (ticket) => getSLAStatus(ticket) === "At Risk"
  );

  const breached = allTickets.filter(
    (ticket) => getSLAStatus(ticket) === "Breached"
  );

  const completedTickets = allTickets.filter((ticket) =>
    ["resolved", "closed", "completed"].includes(
      (ticket.status || "").toLowerCase()
    )
  );

  const getBadgeClass = (status) => {
    switch (status) {
      case "Met / Succeeded":
      case "Met SLA":
        return "sla-met";
      case "Within SLA":
      case "In Progress / Running":
        return "sla-within";
      case "At Risk":
      case "Warning / At Risk":
        return "sla-risk";
      case "Breached":
      case "Breached / Violated":
        return "sla-breached";
      case "On Hold":
      case "Completed":
        return "sla-unknown";
      default:
        return "sla-unknown";
    }
  };

  // Calculate SLA compliance rates by priority dynamically from real ticket data
  const calculateCompliance = (priorityName) => {
    const priorityTickets = ticketsWithSLA.filter(
      (t) => (t.priority || "").toLowerCase() === priorityName.toLowerCase()
    );
    if (priorityTickets.length === 0) return 0;
    const compliant = priorityTickets.filter(
      (t) => getSLAStatus(t) !== "Breached"
    ).length;
    return Math.round((compliant / priorityTickets.length) * 100);
  };

  const performanceItems = [
    { name: "Critical", value: calculateCompliance("Critical") },
    { name: "High", value: calculateCompliance("High") },
    { name: "Medium", value: calculateCompliance("Medium") },
    { name: "Low", value: calculateCompliance("Low") },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>SLA Management</h2>
          <p>Monitor service-level agreements and ticket deadlines</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">All Tickets</span>
          <strong className="stat-value">{allTickets.length}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Active Tickets</span>
          <strong className="stat-value">{activeTickets.length}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Within SLA</span>
          <strong className="stat-value">{withinSLA.length}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">At Risk</span>
          <strong className="stat-value">{atRisk.length}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Breached</span>
          <strong className="stat-value">{breached.length}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <strong className="stat-value">{completedTickets.length}</strong>
        </div>
      </div>

      {/* SLA PERFORMANCE SECTION — MATCHING REFERENCE IMAGE */}
      <section className="panel sla-performance">
        <div className="panel-header">
          <div>
            <h3>SLA Performance</h3>
            <p>Compliance by priority</p>
          </div>
        </div>

        <div className="sla-performance-grid">
          {performanceItems.map((item) => (
            <div className="sla-performance-card" key={item.name}>
              <div className="sla-performance-top">
                <span
                  className={`priority-dot priority-${item.name.toLowerCase()}`}
                />
                <span className="sla-priority-name">{item.name}</span>
                <span className="sla-percentage">{item.value}%</span>
              </div>

              <div className="sla-progress-track">
                <div
                  className={`sla-progress-fill priority-${item.name.toLowerCase()}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>

              <div className="sla-performance-footer">
                <span
                  className={`sla-performance-status ${
                    item.value >= 80 ? "status-good" : "status-low"
                  }`}
                >
                  {item.value >= 80 ? "Excellent" : "Needs attention"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>SLA Monitoring</h3>
            <p>{ticketsWithSLA.length} ticket(s) with an SLA deadline</p>
          </div>
        </div>

        {allTickets.length === 0 ? (
          <div className="empty-state">
            No tickets found. Create a ticket to begin monitoring SLAs.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Ticket Status</th>
                  <th>SLA Target</th>
                  <th>Deadline</th>
                  <th>Remaining</th>
                  <th>SLA Status</th>
                </tr>
              </thead>

              <tbody>
                {allTickets.map((ticket) => {
                  const slaStatus = getSLAStatus(ticket);

                  return (
                    <tr key={ticket.id}>
                      <td>
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="ticket-id"
                        >
                          {ticket.ticket_number || ticket.id}
                        </Link>
                      </td>

                      <td>
                        <strong>{ticket.title}</strong>
                      </td>

                      <td>
                        <PriorityBadge priority={ticket.priority} />
                      </td>

                      <td>
                        {(() => {
                          const rawStatus = ticket.status || "Unknown";
                          const status = rawStatus
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, "-");

                          return (
      <span className={`status-pill status-${status}`}>
        <span className="status-dot" />
        {rawStatus}
      </span>
    );
  })()}
                      </td>

                      <td>
                        {ticket.sla_target_hours
                          ? `${ticket.sla_target_hours} hours`
                          : "N/A"}
                      </td>

                      <td>
                        {ticket.sla_deadline
                          ? parseDate(ticket.sla_deadline)?.toLocaleString()
                          : "N/A"}
                      </td>

                      <td>
                        {formatRemainingTime(ticket.sla_deadline, ticket)}
                      </td>

                      <td>
                        <span
                          className={`sla-badge ${getBadgeClass(slaStatus)}`}
                        >
                          {slaStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}


/* =========================
   ANALYTICS
========================= */


function Analytics({ tickets }) {
  const [period, setPeriod] = useState("all");

  const activePeriod =
    ANALYTICS_PERIODS.find((item) => item.id === period) ||
    ANALYTICS_PERIODS[0];

  const allTickets = tickets || [];

  const ticketData = useMemo(
    () => filterTicketsByPeriod(allTickets, activePeriod.days),
    [allTickets, activePeriod.days]
  );

  // =====================================
  // SUMMARY METRICS
  // =====================================

  const totalTickets = ticketData.length;

  const openTickets = ticketData.filter(
    (ticket) =>
      ticket.status === "Open" ||
      ticket.status === "In Progress"
  ).length;

  const resolvedTickets = ticketData.filter(
    (ticket) =>
      ticket.status === "Resolved" ||
      ticket.status === "Closed"
  ).length;

  // =====================================
  // SLA METRICS
  // =====================================

  const {
    ticketsWithSLA,
    slaCounts,
    completedSLATickets,
    slaCompliance,
  } = calculateTicketMetrics(ticketData);

  const breachedTickets = slaCounts.breached;

  // =====================================
  // CHART COLORS
  // =====================================

  const chartColors = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.muted,
    CHART_COLORS.warning,
    CHART_COLORS.danger,
  ];

  // =====================================
  // TICKETS BY PRIORITY
  // =====================================

  const priorityDistribution = [
    "Critical",
    "High",
    "Medium",
    "Low",
  ].map((priority) => ({
    name: priority,
    value: ticketData.filter(
      (ticket) => ticket.priority === priority
    ).length,
  }));

  // =====================================
  // TICKET STATUS OVERVIEW
  // =====================================

  const statusData = [
    "Open",
    "In Progress",
    "Resolved",
    "Closed",
  ].map((status) => ({
    name: status,
    value: ticketData.filter(
      (ticket) => ticket.status === status
    ).length,
  }));

  // =====================================
  // TICKETS BY CATEGORY
  // =====================================

  const categories = [
    "Hardware",
    "Software",
    "Network",
    "Account",
    "Other",
  ]
    .map((category) => ({
      name: category,
      value: ticketData.filter(
        (ticket) => ticket.category === category
      ).length,
    }))
    .filter((item) => item.value > 0);

  // =====================================
  // MONTHLY TICKET TRENDS
  // =====================================

  const monthlyMap = {};

  ticketData.forEach((ticket) => {
    const dateText = String(ticket.created_at || "");
    const match = dateText.match(/^(\d{4})-(\d{2})/);

    if (!match) return;

    const monthKey = `${match[1]}-${match[2]}`;

    const monthDate = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      1
    );

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthDate.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        tickets: 0,
        resolved: 0,
      };
    }

    monthlyMap[monthKey].tickets++;

    if (["Resolved", "Closed"].includes(ticket.status)) {
      monthlyMap[monthKey].resolved++;
    }
  });

  const monthlyData = Object.keys(monthlyMap)
    .sort()
    .slice(-6)
    .map((key) => monthlyMap[key]);

  // =====================================
  // IT STAFF PERFORMANCE
  // =====================================

  const staffMap = {};

  ticketData.forEach((ticket) => {
    const staffName = ticket.assigned_to_name || "Unassigned";

    if (!staffMap[staffName]) {
      staffMap[staffName] = {
        name: staffName,
        assigned: 0,
        resolved: 0,
      };
    }

    staffMap[staffName].assigned++;

    if (["Resolved", "Closed"].includes(ticket.status)) {
      staffMap[staffName].resolved++;
    }
  });

  const staffData = Object.values(staffMap)
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 6);

  // =====================================
  // SLA PERFORMANCE BY PRIORITY
  // =====================================

  const priorityData = [
    "Critical",
    "High",
    "Medium",
    "Low",
  ].map((priority) => {
    const priorityTickets = completedSLATickets.filter(
      (ticket) => ticket.priority === priority
    );

    const priorityMet = priorityTickets.filter(
      (ticket) => getSlaCategory(ticket) === "Met"
    ).length;

    return {
      name: priority,
      value:
        priorityTickets.length > 0
          ? Math.round(
              (priorityMet / priorityTickets.length) * 100
            )
          : 0,
    };
  });

  // =====================================
  // CURRENT DATASET OVERVIEW
  // =====================================

  const assignedTickets = ticketData.filter(
    (ticket) =>
      ticket.assigned_to_name &&
      ticket.assigned_to_name !== "Unassigned"
  ).length;

  const unassignedTickets = totalTickets - assignedTickets;

  const ticketsWithoutSLA = Math.max(
    0,
    totalTickets - ticketsWithSLA.length
  );

  const categoryCount = categories.length;

  const staffCount = new Set(
    ticketData
      .map((ticket) => ticket.assigned_to_name)
      .filter((name) => name && name !== "Unassigned")
  ).size;

  // =====================================
  // RESOLUTION TIME
  // =====================================

  const resolutionHours = ticketData
    .filter(isCompletedTicket)
    .map(getResolutionHours)
    .filter((hours) => hours !== null);

  const averageResolution = average(resolutionHours);
  const medianResolution = median(resolutionHours);
  const fastestResolution =
    resolutionHours.length > 0 ? Math.min(...resolutionHours) : null;
  const slowestResolution =
    resolutionHours.length > 0 ? Math.max(...resolutionHours) : null;

  // Most common SLA target recorded for a priority (from real ticket data)
  const targetForPriority = (priority) => {
    const counts = {};

    ticketData.forEach((ticket) => {
      if (ticket.priority !== priority) return;

      const target = Number(ticket.sla_target_hours);

      if (!Number.isFinite(target) || target <= 0) return;

      counts[target] = (counts[target] || 0) + 1;
    });

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return ranked.length > 0 ? Number(ranked[0][0]) : null;
  };

  const resolutionByPriority = [
    "Critical",
    "High",
    "Medium",
    "Low",
  ].map((priority) => {
    const hours = ticketData
      .filter(
        (ticket) =>
          ticket.priority === priority && isCompletedTicket(ticket)
      )
      .map(getResolutionHours)
      .filter((hours) => hours !== null);

    return {
      name: priority,
      count: hours.length,
      average: average(hours),
      target: targetForPriority(priority),
    };
  });

  const resolutionByPriorityChart = resolutionByPriority.map((item) => ({
    name: item.name,
    average:
      item.average === null ? null : Number(item.average.toFixed(1)),
    target: item.target,
  }));

  // =====================================
  // AGENT SCORECARD
  // =====================================

  const agentScorecard = Object.values(
    ticketData.reduce((rows, ticket) => {
      const name = ticket.assigned_to_name || "Unassigned";

      const row =
        rows[name] ||
        (rows[name] = {
          name,
          total: 0,
          open: 0,
          resolved: 0,
          slaTracked: 0,
          slaMet: 0,
          hours: [],
        });

      row.total += 1;

      if (["Open", "In Progress"].includes(ticket.status)) {
        row.open += 1;
      }

      if (isCompletedTicket(ticket)) {
        row.resolved += 1;

        const hours = getResolutionHours(ticket);

        if (hours !== null) row.hours.push(hours);

        if (hasSlaDeadline(ticket)) {
          row.slaTracked += 1;

          if (getSlaCategory(ticket) === "Met") {
            row.slaMet += 1;
          }
        }
      }

      return rows;
    }, {})
  )
    .map((row) => ({
      ...row,
      averageHours: average(row.hours),
      slaRate:
        row.slaTracked > 0
          ? Math.round((row.slaMet / row.slaTracked) * 100)
          : null,
    }))
    .sort((a, b) => b.resolved - a.resolved || b.total - a.total);

  // =====================================
  // DASHBOARD UI
  // =====================================

  return (
    <>
      {/* PAGE HEADING */}
      <div className="page-heading">
        <div>
          <h2>Analytics</h2>
          <p>Analyze IT support performance</p>
        </div>

        <div
          className="report-period-tabs"
          role="tablist"
          aria-label="Analytics period"
        >
          {ANALYTICS_PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              className={`report-period-tab ${
                period === item.id ? "is-active" : ""
              }`}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="analytics-cards executive-summary">

        <div className="metric-card">
          <span>Total Tickets</span>
          <strong>{totalTickets}</strong>
          <small>Tickets in system</small>
        </div>

        <div className="metric-card">
          <span>Met SLA</span>
          <strong>{slaCounts.met}</strong>
          <small>Resolved within SLA</small>
        </div>

        <div className="metric-card">
          <span>Open Tickets</span>
          <strong>{openTickets}</strong>
          <small>Currently active</small>
        </div>

        <div className="metric-card">
          <span>Resolved Tickets</span>
          <strong>{resolvedTickets}</strong>
          <small>Resolved or closed</small>
        </div>

        <div className="metric-card">
          <span>Breached Tickets</span>
          <strong>{breachedTickets}</strong>
          <small>Exceeded SLA deadline</small>
        </div>

        <div className="metric-card">
          <span>SLA Compliance</span>
          <strong>{slaCompliance}%</strong>
          <small>Overall SLA success rate</small>
        </div>

        <div className="metric-card">
          <span>Avg. Resolution</span>
          <strong>{formatDuration(averageResolution)}</strong>
          <small>{resolutionHours.length} completed tickets</small>
        </div>

        <div className="metric-card">
          <span>Median Resolution</span>
          <strong>{formatDuration(medianResolution)}</strong>
          <small>Half resolve faster</small>
        </div>

      </div>

      {/* EXECUTIVE ANALYTICS GRID */}
      <div className="analytics-executive-grid">

        {/* TICKETS BY PRIORITY */}
        <section className="panel analytics-priority">
          <div className="panel-header">
            <div>
              <h3>Tickets by Priority</h3>
              <p>Distribution of ticket urgency</p>
            </div>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityDistribution}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />

                <Bar
                  dataKey="value"
                  name="Tickets"
                  fill={CHART_COLORS.primary}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* SLA PERFORMANCE */}
        <section className="panel analytics-sla">
          <div className="panel-header">
            <div>
              <h3>SLA Performance</h3>
              <p>Compliance by priority</p>
            </div>
          </div>

          <div className="performance-list">
            {priorityData.map((item) => {
              const colors = {
                Critical: CHART_COLORS.danger,
                High: CHART_COLORS.warning,
                Medium: CHART_COLORS.primary,
                Low: CHART_COLORS.secondary,
              };

              return (
                <div
                  className="performance-row"
                  key={item.name}
                >
                  <div className="performance-row-header">
                    <div className="performance-label">
                      <span
                        className="performance-dot"
                        style={{
                          backgroundColor: colors[item.name],
                        }}
                      />
                      <span>{item.name}</span>
                    </div>

                    <strong>{item.value}%</strong>
                  </div>

                  <div
                    className="performance-track"
                    role="progressbar"
                    aria-label={`${item.name} SLA compliance`}
                    aria-valuenow={item.value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="performance-fill"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: colors[item.name],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TICKETS BY CATEGORY */}
        <section className="panel analytics-category">
          <div className="panel-header">
            <div>
              <h3>Tickets by Category</h3>
              <p>Distribution of support requests</p>
            </div>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {categories.map((item, index) => (
                    <Cell
                      key={`category-${index}`}
                      fill={
                        chartColors[index % chartColors.length]
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>


{/* MONTHLY TICKET TRENDS - TWO LINES */}
<div className="panel analytics-monthly">
  <h3>Monthly Ticket Trends</h3>

  <ResponsiveContainer width="100%" height={300}>
    <LineChart
      data={monthlyData}
      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
    >
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
      />

      <XAxis dataKey="month" />
      <YAxis allowDecimals={false} />

      <Tooltip />
      <Legend />

      <Line
        type="monotone"
        dataKey="tickets"
        name="Created Tickets"
        stroke={CHART_COLORS.primary}
        strokeWidth={3}
        dot={{ r: 4 }}
        activeDot={{ r: 6 }}
      />

      <Line
        type="monotone"
        dataKey="resolved"
        name="Resolved Tickets"
        stroke={CHART_COLORS.secondary}
        strokeWidth={3}
        dot={{ r: 4 }}
        activeDot={{ r: 6 }}
      />
    </LineChart>
  </ResponsiveContainer>
</div>


        {/* IT STAFF PERFORMANCE */}
        <section className="panel analytics-staff">
          <div className="panel-header">
            <div>
              <h3>IT Staff Performance</h3>
              <p>Assigned and resolved tickets by staff member</p>
            </div>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={staffData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="4 4"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                />

                <Tooltip />
                <Legend />

                <Bar
                  dataKey="assigned"
                  name="Assigned"
                  fill={CHART_COLORS.primary}
                  radius={[0, 6, 6, 0]}
                />

                <Bar
                  dataKey="resolved"
                  name="Resolved"
                  fill={CHART_COLORS.secondary}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* TICKET STATUS OVERVIEW - BAR CHART */}
        <section className="panel analytics-status">
          <div className="panel-header">
            <div>
              <h3>Ticket Status Overview</h3>
              <p>Current status of support requests</p>
            </div>
          </div>

        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={statusData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
              />

              <XAxis
                type="number"
                allowDecimals={false}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={100}
              />

              <Tooltip />
              <Bar
                dataKey="value"
                name="Tickets"
                radius={[0, 8, 8, 0]}
                barSize={28}
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      {
                        Open: "#3B82F6",
                        "In Progress": "#F59E0B",
                        Resolved: "#10B981",
                        Closed: "#8B5CF6",
                      }[entry.name] || "#94A3B8"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        </section>

      </div>


      {/* RESOLUTION PERFORMANCE */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Resolution Performance</h3>
            <p>
              How long completed tickets took to fix
              {activePeriod.days ? ` · ${activePeriod.label}` : ""}
            </p>
          </div>
          <span className="chart-label">
            {resolutionHours.length} completed
          </span>
        </div>

        <div className="dataset-summary">
          <div>
            <span>Average</span>
            <strong>{formatDuration(averageResolution)}</strong>
          </div>

          <div>
            <span>Median</span>
            <strong>{formatDuration(medianResolution)}</strong>
          </div>

          <div>
            <span>Fastest</span>
            <strong>{formatDuration(fastestResolution)}</strong>
          </div>

          <div>
            <span>Slowest</span>
            <strong>{formatDuration(slowestResolution)}</strong>
          </div>
        </div>

        <div className="report-subsection">
          <h4>Average resolution vs SLA target</h4>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={resolutionByPriorityChart}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke={CHART_COLORS.grid}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value, name) => [
                    name === "SLA target"
                      ? `${value} hrs`
                      : formatDuration(value),
                    name,
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${CHART_COLORS.grid}`,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />

                <Bar
                  dataKey="average"
                  name="Average resolution"
                  fill={CHART_COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="target"
                  name="SLA target"
                  fill={CHART_COLORS.muted}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="report-note">
            SLA target is the most common target recorded for that
            priority in the selected period.
          </p>
        </div>
      </section>

      {/* AGENT SCORECARD */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Agent Scorecard</h3>
            <p>
              Workload, resolution speed and SLA success by agent
            </p>
          </div>
          <span className="chart-label">
            {agentScorecard.length} agents
          </span>
        </div>

        {agentScorecard.length === 0 ? (
          <p className="muted-text">
            No tickets assigned to agents in this period.
          </p>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Assigned</th>
                  <th>Open</th>
                  <th>Resolved</th>
                  <th>Avg. resolution</th>
                  <th>SLA success</th>
                </tr>
              </thead>

              <tbody>
                {agentScorecard.map((agent, index) => (
                  <tr key={agent.name}>
                    <td>
                      <div className="scorecard-cell">
                        <span className="report-rank">
                          {index + 1}
                        </span>
                        <div className="scorecard-name">
                          <strong>{agent.name}</strong>
                          <small>
                            {agent.total} assigned
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>{agent.total}</td>
                    <td>{agent.open}</td>
                    <td>{agent.resolved}</td>
                    <td>{formatDuration(agent.averageHours)}</td>

                    <td>
                      {agent.slaRate === null ? (
                        <span className="report-muted">
                          No SLA data
                        </span>
                      ) : (
                        <div className="scorecard-cell">
                          <span
                            className={`report-rate ${
                              agent.slaRate >= 90
                                ? "good"
                                : agent.slaRate >= 70
                                ? "warning"
                                : "poor"
                            }`}
                          >
                            {agent.slaRate}%
                          </span>
                          <span className="scorecard-bar">
                            <span
                              style={{
                                width: `${agent.slaRate}%`,
                                background:
                                  agent.slaRate >= 90
                                    ? CHART_COLORS.success
                                    : agent.slaRate >= 70
                                    ? CHART_COLORS.warning
                                    : CHART_COLORS.danger,
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="report-note">
          SLA success is measured on completed tickets that have an
          SLA deadline.
        </p>
      </section>


{/* DATA COVERAGE & ASSIGNMENT OVERVIEW */}

<div className="panel analytics-coverage">

  <div className="coverage-header">
    <div>
      <h3>Data Coverage & Assignment Overview</h3>
      <p>Ticket distribution and IT service desk resources</p>
    </div>

    <span className="coverage-status">
      <span className="status-dot"></span>
      Live Data
    </span>
  </div>

  <div className="coverage-grid">

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot blue"></span>
        <span>Total Assigned</span>
      </div>
      <strong>{assignedTickets}</strong>
      <small>Tickets assigned to IT staff</small>
    </div>

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot orange"></span>
        <span>Unassigned</span>
      </div>
      <strong>{unassignedTickets}</strong>
      <small>Awaiting staff assignment</small>
    </div>

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot green"></span>
        <span>SLA Coverage</span>
      </div>
      <strong>{ticketsWithSLA.length}</strong>
      <small>Tickets with SLA tracking</small>
    </div>

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot red"></span>
        <span>Missing SLA</span>
      </div>
      <strong>{ticketsWithoutSLA}</strong>
      <small>Tickets without SLA tracking</small>
    </div>

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot purple"></span>
        <span>Categories</span>
      </div>
      <strong>{categoryCount}</strong>
      <small>Different ticket categories</small>
    </div>

    <div className="coverage-item">
      <div className="coverage-item-heading">
        <span className="coverage-dot teal"></span>
        <span>IT Staff Members</span>
      </div>
      <strong>{staffCount}</strong>
      <small>Staff handling tickets</small>
    </div>

  </div>
</div>

    </>
  );
}


/* =========================
   USERS PAGE
========================= */


function UsersPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
  });

  // ADMIN AND IT STAFF PERMISSIONS
  const currentRole = String(currentUser?.role || "")
    .trim()
    .toLowerCase();

const canManageUsers = currentRole === "admin";
const isAdmin = currentRole === "admin";

  // LOAD USERS
  const loadUsers = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5001/api/users", {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load users.");
      }

      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // FORM INPUT HANDLER
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // CREATE USER
  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!canManageUsers) {
      alert("You do not have permission to add users.");
      return;
    }

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      alert("Please fill out all required fields.");
      return;
    }

    if (form.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5001/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create user.");
      }

      alert("User created successfully!");

      setForm({
        name: "",
        email: "",
        password: "",
        role: "employee",
      });

      setShowAddUser(false);
      await loadUsers();
    } catch (error) {
      console.error("Failed to create user:", error);
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT USER
  const handleEditUser = async (e) => {
    e.preventDefault();

    if (!canManageUsers) {
      alert("You do not have permission to edit users.");
      return;
    }

    if (!editingUser) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            name: editingUser.name.trim(),
            email: editingUser.email.trim(),
            role: editingUser.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update user.");
      }

      alert("User updated successfully.");

      setShowEditUser(false);
      setEditingUser(null);

      await loadUsers();
    } catch (error) {
      console.error("Failed to update user:", error);
      alert(error.message);
    }
  };

  // DELETE USER
  const handleDeleteUser = async (user) => {
    if (!canManageUsers) {
      alert("You do not have permission to delete users.");
      return;
    }

    if (!user) return;

    // Prevent deleting your own account
    if (String(user.id) === String(currentUser?.id)) {
      alert("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5001/api/users/${user.id}`,
        {
          method: "DELETE",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete user.");
      }

      alert("User deleted successfully.");

      await loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert(error.message);
    }
  };


  // SEARCH USERS
  const filteredUsers = users.filter((user) => {
    const userRole = String(user.role || "").toLowerCase();

    // Employees can only see IT Staff and Admin
    const canViewUser =
      currentRole !== "employee" ||
      ["it_staff", "admin"].includes(userRole);

    const matchesSearch =
      `${user.name} ${user.email} ${user.role}`
        .toLowerCase()
        .includes(search.toLowerCase());

    return canViewUser && matchesSearch;
  });


  return (
    <div className="users-page-wrapper">
      <div className="page-heading">
        <div>
          <h2>Users</h2>
          <p>Manage employees and IT support staff</p>
        </div>

        {isAdmin && (
          <button
            className="primary-btn"
            onClick={() => setShowAddUser(true)}
          >
            <UserPlus size={18} />
            Add User
          </button>
        )}
      </div>

      <section className="panel">
        <div className="ticket-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">No users found.</div>
        ) : (
          <div className="user-grid">
            {filteredUsers.map((user) => {
              const initials = (user.name || "User")
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const userColor =
                String(user.name || "User")
                  .split("")
                  .reduce(
                    (sum, char) => sum + char.charCodeAt(0),
                    0
                  ) % 6;

              const displayRole =
                user.role === "it_staff"
                  ? "IT Staff"
                  : user.role === "admin"
                  ? "Admin"
                  : "Employee";

              return (
                <div className="user-card" key={user.id}>
                  <div className={`large-avatar user-color-${userColor}`}>
                    {initials}
                  </div>

                  <div className="user-info">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <span className="role-tag">{displayRole}</span>
                  </div>

                  <div className="user-actions">
                    <span className="active-dot">● Active</span>

                    {canManageUsers && (
                      <>
                        <button
                          type="button"
                          title="Edit user"
                          onClick={() => {
                            setEditingUser({
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              role: user.role,
                            });
                            setShowEditUser(true);
                          }}
                        >
                          <Edit3 size={16} />
                        </button>

                        {String(user.id) !== String(currentUser?.id) && (
                          <button
                            type="button"
                            title="Delete user"
                            className="delete-user-btn"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ADD USER MODAL */}
      {canManageUsers && showAddUser && createPortal(
        (
          <div
            className="modal-overlay add-user-overlay"
            onClick={() => setShowAddUser(false)}
          >
            <div
              className="modal-card add-user-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h2>Add User</h2>
                  <p>Create a new IT ServiceHub account</p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowAddUser(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email address"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={handleChange}
                    minLength={6}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                  >
                    <option value="employee">Employee</option>
                    <option value="it_staff">IT Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setShowAddUser(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={submitting}
                  >
                    <UserPlus size={18} />
                    {submitting ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ),
        document.body
      )}

      {/* EDIT USER MODAL */}
      {canManageUsers && showEditUser && editingUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEditUser(false);
            setEditingUser(null);
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Edit User</h2>
                <p>Update IT ServiceHub account</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowEditUser(false);
                  setEditingUser(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      email: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="employee">Employee</option>
                  <option value="it_staff">IT Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowEditUser(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/* =========================
   REPORTS
========================= */



function Reports({ tickets }) {
  const ticketData = tickets || [];

  // -----------------------------
  // FILTER AND TABLE STATE
  // -----------------------------
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStaff, setFilterStaff] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [section, setSection] = useState("overview");
  const [periodId, setPeriodId] = useState("all");

  // -----------------------------
  // HELPER FUNCTIONS
  // -----------------------------
  const toDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const applyPeriod = (item) => {
    if (!item.days) {
      setStartDate("");
      setEndDate("");
    } else {
      const end = new Date();
      const start = new Date(end.getTime() - item.days * HOUR_MS);

      setStartDate(toDateInput(start));
      setEndDate(toDateInput(end));
    }

    setPeriodId(item.id);
    resetPage();
  };

  const getReportSlaStatus = (ticket) => {
    if (!hasSlaDeadline(ticket)) {
      return "No SLA";
    }

    return ticket.sla_status || getSlaCategory(ticket);
  };

  const isCompleted = (ticket) =>
    ["Resolved", "Closed"].includes(ticket.status);

  const isActive = (ticket) =>
    ["Open", "In Progress"].includes(ticket.status);

  const getResolutionHours = (ticket) => {
    if (!ticket.created_at || !ticket.resolved_at) {
      return null;
    }

    const created = new Date(ticket.created_at).getTime();
    const resolved = new Date(ticket.resolved_at).getTime();

    if (
      !Number.isFinite(created) ||
      !Number.isFinite(resolved) ||
      resolved < created
    ) {
      return null;
    }

    return (resolved - created) / (1000 * 60 * 60);
  };

  const formatHours = (hours) => {
    if (hours === null || !Number.isFinite(hours)) {
      return "N/A";
    }

    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }

    if (hours >= 24) {
      return `${(hours / 24).toFixed(1)} days`;
    }

    return `${hours.toFixed(1)} hrs`;
  };

  const getDateKey = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const isSlaMet = (ticket) => {
    const status = String(getReportSlaStatus(ticket)).toLowerCase();

    return (
      status.includes("met") ||
      status.includes("succeeded") ||
      status.includes("within sla")
    );
  };

  const resetPage = () => setCurrentPage(1);

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setFilterPriority("All");
    setFilterStatus("All");
    setFilterCategory("All");
    setFilterStaff("All");
    setSearchTerm("");
    setSortBy("created_at");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDirection((previous) =>
        previous === "asc" ? "desc" : "asc"
      );
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }

    resetPage();
  };

  // -----------------------------
  // FILTER OPTIONS
  // -----------------------------
  const staffOptions = [
    ...new Set(
      ticketData.map(
        (ticket) => ticket.assigned_to_name || "Unassigned"
      )
    ),
  ].sort();

  const categoryOptions = [
    ...new Set(
      ticketData
        .map((ticket) => ticket.category)
        .filter(Boolean)
    ),
  ].sort();

  const statusOptions = [
    ...new Set(
      ticketData
        .map((ticket) => ticket.status)
        .filter(Boolean)
    ),
  ].sort();

  // -----------------------------
  // FILTERED TICKETS
  // -----------------------------
  const filteredTickets = ticketData.filter((ticket) => {
    const ticketDate = getDateKey(ticket.created_at);

    if (startDate && (!ticketDate || ticketDate < startDate)) {
      return false;
    }

    if (endDate && (!ticketDate || ticketDate > endDate)) {
      return false;
    }

    if (
      filterPriority !== "All" &&
      ticket.priority !== filterPriority
    ) {
      return false;
    }

    if (
      filterStatus !== "All" &&
      ticket.status !== filterStatus
    ) {
      return false;
    }

    if (
      filterCategory !== "All" &&
      ticket.category !== filterCategory
    ) {
      return false;
    }

    if (
      filterStaff !== "All" &&
      (ticket.assigned_to_name || "Unassigned") !== filterStaff
    ) {
      return false;
    }

    const search = searchTerm.trim().toLowerCase();

    if (search) {
      const searchableText = [
        ticket.ticket_number,
        ticket.title,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.requester_name,
        ticket.assigned_to_name,
      ]
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(search)) {
        return false;
      }
    }

    return true;
  });

  // -----------------------------
  // VOLUME TREND (opened vs resolved by day)
  // -----------------------------
  const volumeTrend = (() => {
    const buckets = {};

    const ensure = (key) => {
      if (!buckets[key]) {
        buckets[key] = { date: key, created: 0, resolved: 0 };
      }

      return buckets[key];
    };

    filteredTickets.forEach((ticket) => {
      const createdKey = getDateKey(ticket.created_at);

      if (createdKey) ensure(createdKey).created += 1;

      const resolvedKey = getDateKey(ticket.resolved_at);

      if (resolvedKey) ensure(resolvedKey).resolved += 1;
    });

    return Object.keys(buckets)
      .sort()
      .map((key) => {
        const [year, month, day] = key.split("-").map(Number);

        return {
          ...buckets[key],
          label: new Date(
            year,
            month - 1,
            day
          ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        };
      });
  })();

  // -----------------------------
  // SORTED TICKETS
  // -----------------------------
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const first = a[sortBy] ?? "";
    const second = b[sortBy] ?? "";

    let comparison;

    if (
      sortBy === "created_at" ||
      sortBy === "resolved_at"
    ) {
      comparison =
        new Date(first).getTime() - new Date(second).getTime();

      if (!Number.isFinite(comparison)) comparison = 0;
    } else {
      comparison = String(first).localeCompare(
        String(second),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // -----------------------------
  // PAGINATION
  // -----------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(sortedTickets.length / pageSize)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedTickets = sortedTickets.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // -----------------------------
  // FILTERED DASHBOARD METRICS
  // -----------------------------
  const totalTickets = filteredTickets.length;

  const openTickets = filteredTickets.filter(isActive).length;

  const resolvedTickets = filteredTickets.filter(
    isCompleted
  ).length;

  const {
    ticketsWithSLA,
    ticketsWithoutSLA,
    slaCounts,
    slaCompliance,
  } = calculateTicketMetrics(filteredTickets);

  const breachedTickets = slaCounts.breached;

  const withinSlaTickets = ticketsWithSLA.filter(
    (ticket) => getSlaCategory(ticket) === "Within SLA"
  ).length;

  const atRiskTickets = ticketsWithSLA.filter(
    (ticket) => getSlaCategory(ticket) === "At Risk"
  ).length;

  // -----------------------------
  // PRIORITY AND CATEGORY SUMMARY
  // -----------------------------
  const priorities = ["Critical", "High", "Medium", "Low"].map(
    (priority) => ({
      name: priority,
      count: filteredTickets.filter(
        (ticket) => ticket.priority === priority
      ).length,
    })
  );

  const categories = [
    ...new Set(
      filteredTickets
        .map((ticket) => ticket.category)
        .filter(Boolean)
    ),
  ]
    .sort()
    .map((category) => ({
      name: category,
      count: filteredTickets.filter(
        (ticket) => ticket.category === category
      ).length,
    }));

  // -----------------------------
  // RESOLUTION TIME ANALYTICS
  // -----------------------------
  const resolutionRecords = filteredTickets
    .filter(isCompleted)
    .map((ticket) => ({
      ticket,
      hours: getResolutionHours(ticket),
    }))
    .filter((record) => record.hours !== null);

  const resolutionTimes = resolutionRecords.map(
    (record) => record.hours
  );

  const averageResolutionTime =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, hours) => sum + hours, 0) /
        resolutionTimes.length
      : null;

  const fastestResolution =
    resolutionTimes.length > 0
      ? Math.min(...resolutionTimes)
      : null;

  const longestResolution =
    resolutionTimes.length > 0
      ? Math.max(...resolutionTimes)
      : null;

  // Resolution time grouped by priority
  const resolutionByPriority = [
    "Critical",
    "High",
    "Medium",
    "Low",
  ].map((priority) => {
    const records = resolutionRecords.filter(
      (record) => record.ticket.priority === priority
    );

    const average =
      records.length > 0
        ? records.reduce(
            (sum, record) => sum + record.hours,
            0
          ) / records.length
        : null;

    return {
      priority,
      count: records.length,
      average,
    };
  });

  // -----------------------------
  // STAFF PERFORMANCE
  // -----------------------------
  const staffMap = {};

  filteredTickets.forEach((ticket) => {
    const staffName = ticket.assigned_to_name || "Unassigned";

    if (!staffMap[staffName]) {
      staffMap[staffName] = {
        total: 0,
        open: 0,
        resolved: 0,
        completedWithSLA: 0,
        slaMet: 0,
      };
    }

    const staff = staffMap[staffName];

    staff.total += 1;

    if (isActive(ticket)) {
      staff.open += 1;
    }

    if (isCompleted(ticket)) {
      staff.resolved += 1;

      if (hasSlaDeadline(ticket)) {
        staff.completedWithSLA += 1;

        if (isSlaMet(ticket)) {
          staff.slaMet += 1;
        }
      }
    }
  });

  const staffPerformance = Object.entries(staffMap)
    .map(([staffName, stats]) => ({
      staffName,
      ...stats,
      slaSuccessRate:
        stats.completedWithSLA > 0
          ? Math.round(
              (stats.slaMet / stats.completedWithSLA) * 100
            )
          : null,
    }))
    .sort((a, b) => {
      if (b.resolved !== a.resolved) {
        return b.resolved - a.resolved;
      }

      return b.total - a.total;
    });

  // -----------------------------
  // EXCEL EXPORT HELPER
  // -----------------------------
  const downloadExcel = (
    summaryRows,
    sheetName,
    headers,
    rows,
    filename
  ) => {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

    summarySheet["!cols"] = [
      { wch: 30 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Report Summary"
    );

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      ...rows,
    ]);

    worksheet["!cols"] = headers.map((header, index) => {
      const maxLength = Math.max(
        String(header).length,
        ...rows.map((row) =>
          String(row[index] ?? "").length
        )
      );

      return {
        wch: Math.min(Math.max(maxLength + 3, 14), 35),
      };
    });

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sheetName
    );

    XLSX.writeFile(workbook, filename);
  };

  const buildExportSummary = () => [
    ["IT ServiceHub Report Summary", ""],
    ["Generated At", new Date().toLocaleString()],
    ["", ""],
    ["Report Metric", "Value"],
    ["Total Tickets", totalTickets],
    ["Open Tickets", openTickets],
    ["Resolved / Closed Tickets", resolvedTickets],
    ["SLA Compliance", `${slaCompliance}%`],
    ["Within SLA", withinSlaTickets],
    ["At Risk", atRiskTickets],
    ["Breached", breachedTickets],
    ["Without SLA", ticketsWithoutSLA.length],
    ["", ""],
    ["Applied Filters", ""],
    ["Start Date", startDate || "All dates"],
    ["End Date", endDate || "All dates"],
    ["Priority", filterPriority],
    ["Status", filterStatus],
    ["Category", filterCategory],
    ["Assigned Staff", filterStaff],
    ["Search", searchTerm || "None"],
  ];

  // -----------------------------
  // FULL REPORT EXPORT
  // -----------------------------
  const exportCSV = () => {
    if (filteredTickets.length === 0) {
      alert("No ticket data available to export.");
      return;
    }

    const headers = [
      "Ticket Number",
      "Title",
      "Category",
      "Priority",
      "Status",
      "Requester",
      "Assigned To",
      "SLA Status",
      "SLA Target Hours",
      "SLA Deadline",
      "Created At",
      "Resolved At",
    ];

    const rows = filteredTickets.map((ticket) => [
      ticket.ticket_number || "",
      ticket.title || "",
      ticket.category || "",
      ticket.priority || "",
      ticket.status || "",
      ticket.requester_name || "",
      ticket.assigned_to_name || "Unassigned",
      getReportSlaStatus(ticket),
      ticket.sla_target_hours ?? "",
      ticket.sla_deadline || "",
      ticket.created_at || "",
      ticket.resolved_at || "",
    ]);

    downloadExcel(
      buildExportSummary(),
      "All Tickets",
      headers,
      rows,
      "IT-ServiceHub-Full-Report.xlsx"
    );
  };

  // -----------------------------
  // SLA REPORT EXPORT
  // -----------------------------
  const exportSLAReport = () => {
    if (filteredTickets.length === 0) {
      alert("No ticket data available for the SLA report.");
      return;
    }

    const headers = [
      "Ticket Number",
      "Priority",
      "Status",
      "SLA Status",
      "SLA Target Hours",
      "SLA Deadline",
    ];

    const rows = filteredTickets.map((ticket) => [
      ticket.ticket_number || "",
      ticket.priority || "",
      ticket.status || "",
      getReportSlaStatus(ticket),
      ticket.sla_target_hours ?? "",
      ticket.sla_deadline || "",
    ]);

    downloadExcel(
      buildExportSummary(),
      "SLA Performance",
      headers,
      rows,
      "IT-ServiceHub-SLA-Performance.xlsx"
    );
  };

  // -----------------------------
  // TICKET REPORT EXPORT
  // -----------------------------
  const exportTicketReport = () => {
    if (filteredTickets.length === 0) {
      alert("No ticket data available for the ticket report.");
      return;
    }

    const headers = [
      "Ticket Number",
      "Title",
      "Category",
      "Priority",
      "Status",
      "Requester",
      "Assigned To",
      "Created At",
    ];

    const rows = filteredTickets.map((ticket) => [
      ticket.ticket_number || "",
      ticket.title || "",
      ticket.category || "",
      ticket.priority || "",
      ticket.status || "",
      ticket.requester_name || "",
      ticket.assigned_to_name || "Unassigned",
      ticket.created_at || "",
    ]);

    downloadExcel(
      buildExportSummary(),
      "Ticket Performance",
      headers,
      rows,
      "IT-ServiceHub-Ticket-Performance.xlsx"
    );
  };

  // -----------------------------
  // STAFF REPORT EXPORT
  // -----------------------------
  const exportStaffReport = () => {
    if (staffPerformance.length === 0) {
      alert("No staff data available for the staff report.");
      return;
    }

    const headers = [
      "Staff Name",
      "Total Assigned Tickets",
      "Open Tickets",
      "Resolved Tickets",
      "Completed Tickets With SLA",
      "SLA Met",
      "SLA Success Rate",
    ];

    const rows = staffPerformance.map((staff) => [
      staff.staffName,
      staff.total,
      staff.open,
      staff.resolved,
      staff.completedWithSLA,
      staff.slaMet,
      staff.slaSuccessRate === null
        ? "N/A"
        : `${staff.slaSuccessRate}%`,
    ]);

    downloadExcel(
      buildExportSummary(),
      "Staff Performance",
      headers,
      rows,
      "IT-ServiceHub-Staff-Performance.xlsx"
    );
  };

  // -----------------------------
  // SORT BUTTON
  // -----------------------------
  const SortButton = ({ field, children }) => (
    <button
      type="button"
      className="report-sort-btn"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortBy === field && (
        <span>{sortDirection === "asc" ? " ↑" : " ↓"}</span>
      )}
    </button>
  );

  // -----------------------------
  // PAGE CONTENT
  // -----------------------------
  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Reports</h2>
          <p>
            Generate detailed IT service performance reports
          </p>
        </div>

        <div className="report-actions">
          <button
            className="secondary-btn"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            Print / Save as PDF
          </button>

          <button className="primary-btn" onClick={exportCSV}>
            Export Full Report
          </button>
        </div>
      </div>

      {/* REPORT PERIOD */}
      <div className="report-period-bar">
        <div
          className="report-period-tabs"
          role="tablist"
          aria-label="Report period"
        >
          {ANALYTICS_PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={periodId === item.id}
              className={`report-period-tab ${
                periodId === item.id ? "is-active" : ""
              }`}
              onClick={() => applyPeriod(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* REPORT FILTERS */}
      <section className="panel report-filter-panel">
        <div className="panel-header">
          <div>
            <h3>Report Filters</h3>
            <p>Customize the data included in your reports</p>
          </div>

          <button
            className="report-reset-btn"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="report-filter-grid">
          <div className="report-filter-field">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodId("custom");
                resetPage();
              }}
            />
          </div>

          <div className="report-filter-field">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodId("custom");
                resetPage();
              }}
            />
          </div>

          <div className="report-filter-field">
            <label>Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                resetPage();
              }}
            >
              <option value="All">All Priorities</option>
              {["Critical", "High", "Medium", "Low"].map(
                (priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="report-filter-field">
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                resetPage();
              }}
            >
              <option value="All">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="report-filter-field">
            <label>Category</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                resetPage();
              }}
            >
              <option value="All">All Categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="report-filter-field">
            <label>Assigned Staff</label>
            <select
              value={filterStaff}
              onChange={(e) => {
                setFilterStaff(e.target.value);
                resetPage();
              }}
            >
              <option value="All">All Staff</option>
              {staffOptions.map((staff) => (
                <option key={staff} value={staff}>
                  {staff}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="report-filter-footer">
          <span>
            Showing <strong>{filteredTickets.length}</strong> of{" "}
            <strong>{ticketData.length}</strong> tickets
          </span>
        </div>
      </section>

      {/* REPORT SECTIONS */}
      <div
        className="report-tabs"
        role="tablist"
        aria-label="Report sections"
      >
        {REPORT_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={`report-tab ${
              section === item.id ? "is-active" : ""
            }`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <>
      {/* KPI CARDS */}
      <div className="analytics-cards">
        <div className="metric-card">
          <span>Total Tickets</span>
          <strong>{totalTickets}</strong>
          <small>Matching report filters</small>
        </div>

        <div className="metric-card">
          <span>Open Tickets</span>
          <strong>{openTickets}</strong>
          <small>Currently active</small>
        </div>

        <div className="metric-card">
          <span>Resolved Tickets</span>
          <strong>{resolvedTickets}</strong>
          <small>Resolved or closed</small>
        </div>

        <div className="metric-card">
          <span>SLA Compliance</span>
          <strong>{slaCompliance}%</strong>
          <small>
            {breachedTickets} SLA breach
            {breachedTickets === 1 ? "" : "es"}
          </small>
        </div>
      </div>

      {/* PRIORITY AND CATEGORY */}
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Tickets by Priority</h3>
              <p>Distribution of ticket priorities</p>
            </div>
          </div>

          <div className="report-data-list">
            {priorities.map((item) => (
              <div className="report-data-row" key={item.name}>
                <span>{item.name}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Tickets by Category</h3>
              <p>Distribution of support requests</p>
            </div>
          </div>

          <div className="report-data-list">
            {categories.length === 0 ? (
              <p>No category data available.</p>
            ) : (
              categories.map((item) => (
                <div className="report-data-row" key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

        </>
      )}

      {section === "sla" && (
        <>
      {/* RESOLUTION TIME ANALYTICS */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Resolution Time Analytics</h3>
            <p>
              How long completed tickets took to resolve
            </p>
          </div>
        </div>

        <div className="dataset-summary report-resolution-summary">
          <div>
            <span>Average Resolution</span>
            <strong>
              {formatHours(averageResolutionTime)}
            </strong>
          </div>

          <div>
            <span>Fastest Resolution</span>
            <strong>{formatHours(fastestResolution)}</strong>
          </div>

          <div>
            <span>Longest Resolution</span>
            <strong>{formatHours(longestResolution)}</strong>
          </div>

          <div>
            <span>Records Analyzed</span>
            <strong>{resolutionRecords.length}</strong>
          </div>
        </div>

        <div className="report-subsection">
          <h4>Average Resolution by Priority</h4>

          <div className="report-data-list">
            {resolutionByPriority.map((item) => (
              <div
                className="report-data-row"
                key={item.priority}
              >
                <span>
                  {item.priority}
                  <small className="report-inline-muted">
                    {" "}({item.count} tickets)
                  </small>
                </span>

                <strong>{formatHours(item.average)}</strong>
              </div>
            ))}
          </div>
        </div>

        <p className="report-note">
          Based on completed tickets with valid creation and
          resolution timestamps.
        </p>
      </section>

        </>
      )}

      {section === "overview" && (
        <>
      {/* TICKET PERFORMANCE */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Ticket Performance Report</h3>
            <p>
              Ticket volume, status, priority, and assignment analysis
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={exportTicketReport}
          >
            Export Ticket Report
          </button>
        </div>

        <div className="dataset-summary">
          <div>
            <span>Total Tickets</span>
            <strong>{totalTickets}</strong>
          </div>

          <div>
            <span>Open</span>
            <strong>
              {
                filteredTickets.filter(
                  (ticket) => ticket.status === "Open"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>In Progress</span>
            <strong>
              {
                filteredTickets.filter(
                  (ticket) => ticket.status === "In Progress"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>Resolved / Closed</span>
            <strong>{resolvedTickets}</strong>
          </div>
        </div>
      </section>

        </>
      )}

      {section === "sla" && (
        <>
      {/* SLA PERFORMANCE */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>SLA Performance Report</h3>
            <p>
              SLA compliance, deadlines, and breach analysis
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={exportSLAReport}
          >
            Export SLA Report
          </button>
        </div>

        <div className="dataset-summary">
          <div>
            <span>SLA Compliance</span>
            <strong>{slaCompliance}%</strong>
          </div>

          <div>
            <span>Within SLA</span>
            <strong>{withinSlaTickets}</strong>
          </div>

          <div>
            <span>At Risk</span>
            <strong>{atRiskTickets}</strong>
          </div>

          <div>
            <span>Breached</span>
            <strong>{breachedTickets}</strong>
          </div>

          <div>
            <span>Met SLA</span>
            <strong>{slaCounts.met}</strong>
          </div>

          <div>
            <span>No SLA</span>
            <strong>{ticketsWithoutSLA.length}</strong>
          </div>
        </div>
      </section>

        </>
      )}

      {section === "agents" && (
        <>
      {/* STAFF PERFORMANCE RANKING */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Staff Performance Ranking</h3>
            <p>
              Workload, completed tickets, and SLA success rate
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={exportStaffReport}
          >
            Export Staff Report
          </button>
        </div>

        {staffPerformance.length === 0 ? (
          <p className="report-empty">
            No staff performance data available.
          </p>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Staff Member</th>
                  <th>Total Assigned</th>
                  <th>Open</th>
                  <th>Resolved</th>
                  <th>SLA Success Rate</th>
                </tr>
              </thead>

              <tbody>
                {staffPerformance.map((staff, index) => (
                  <tr key={staff.staffName}>
                    <td>
                      <span className="report-rank">
                        {index + 1}
                      </span>
                    </td>

                    <td>
                      <strong>{staff.staffName}</strong>
                    </td>

                    <td>{staff.total}</td>
                    <td>{staff.open}</td>
                    <td>{staff.resolved}</td>

                    <td>
                      {staff.slaSuccessRate === null ? (
                        <span className="report-muted">
                          N/A
                        </span>
                      ) : (
                        <span
                          className={`report-rate ${
                            staff.slaSuccessRate >= 90
                              ? "good"
                              : staff.slaSuccessRate >= 70
                              ? "warning"
                              : "poor"
                          }`}
                        >
                          {staff.slaSuccessRate}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="report-note">
          SLA success rate is calculated from completed assigned
          tickets that have an SLA deadline.
        </p>
      </section>

        </>
      )}

      {section === "volume" && (
        <>
          {/* VOLUME TRENDS */}
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Volume Trends</h3>
                <p>
                  Tickets opened and resolved over the selected
                  range
                </p>
              </div>
              <span className="chart-label">
                {volumeTrend.length} days with activity
              </span>
            </div>

            {volumeTrend.length === 0 ? (
              <p className="muted-text">
                No tickets match your filters.
              </p>
            ) : (
              <>
                <div className="analytics-chart">
                  <ResponsiveContainer
                    width="100%"
                    height={300}
                  >
                    <LineChart data={volumeTrend}>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke={CHART_COLORS.grid}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{
                          fontSize: 11,
                          fill: CHART_COLORS.axis,
                        }}
                        axisLine={{ stroke: CHART_COLORS.grid }}
                        tickLine={false}
                        minTickGap={18}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{
                          fontSize: 11,
                          fill: CHART_COLORS.axis,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: `1px solid ${CHART_COLORS.grid}`,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />

                      <Line
                        type="monotone"
                        dataKey="created"
                        name="Opened"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="resolved"
                        name="Resolved"
                        stroke={CHART_COLORS.secondary}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-legend">
                  <span className="chart-legend-item">
                    <span
                      className="legend-swatch"
                      style={{
                        background: CHART_COLORS.primary,
                      }}
                    />
                    Opened
                  </span>

                  <span className="chart-legend-item">
                    <span
                      className="legend-swatch"
                      style={{
                        background: CHART_COLORS.secondary,
                      }}
                    />
                    Resolved
                  </span>
                </div>
              </>
            )}

            <p className="report-note">
              Daily counts across the selected date range.
            </p>
          </section>
        </>
      )}

      {/* DETAILED TICKET TABLE */}
      <section className="panel">
        <div className="panel-header report-detail-header">
          <div>
            <h3>Detailed Ticket Report</h3>
            <p>
              Search, sort, and review individual ticket records
            </p>
          </div>
        </div>

        <div className="report-table-toolbar">
          <div className="report-search">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search ticket number, title, requester..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetPage();
              }}
            />
          </div>

          <div className="report-page-size">
            <label>Rows</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                resetPage();
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>
                  <SortButton field="ticket_number">
                    Ticket ID
                  </SortButton>
                </th>

                <th>
                  <SortButton field="title">
                    Title
                  </SortButton>
                </th>

                <th>
                  <SortButton field="priority">
                    Priority
                  </SortButton>
                </th>

                <th>
                  <SortButton field="status">
                    Status
                  </SortButton>
                </th>

                <th>Assigned To</th>

                <th>SLA Status</th>

                <th>
                  <SortButton field="created_at">
                    Created
                  </SortButton>
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="report-empty">
                    No tickets match your filters.
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>
                        {ticket.ticket_number || `#${ticket.id}`}
                      </strong>
                    </td>

                    <td>{ticket.title || "Untitled"}</td>

                    <td>
                      <span
                        className={`report-priority priority-${String(
                          ticket.priority || "medium"
                        ).toLowerCase()}`}
                      >
                        {ticket.priority || "N/A"}
                      </span>
                    </td>

                    <td>
                      <span className="report-status">
                        {ticket.status || "N/A"}
                      </span>
                    </td>

                    <td>
                      {ticket.assigned_to_name || "Unassigned"}
                    </td>

                    <td>
                      <span className="report-sla">
                        {getReportSlaStatus(ticket)}
                      </span>
                    </td>

                    <td>
                      {ticket.created_at
                        ? new Date(
                            ticket.created_at
                          ).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="report-pagination">
          <span>
            Showing{" "}
            {sortedTickets.length === 0
              ? 0
              : (safePage - 1) * pageSize + 1}
            {" "}–{" "}
            {Math.min(safePage * pageSize, sortedTickets.length)}
            {" "}of {sortedTickets.length} tickets
          </span>

          <div className="report-pagination-actions">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
            >
              Previous
            </button>

            <span>
              Page {safePage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* REPORT SUMMARY */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Report Summary</h3>
            <p>
              Current IT service performance based on filtered ticket data
            </p>
          </div>
        </div>

        <div className="dataset-summary">
          <div>
            <span>Total Records</span>
            <strong>{totalTickets}</strong>
          </div>

          <div>
            <span>Open</span>
            <strong>{openTickets}</strong>
          </div>

          <div>
            <span>Resolved</span>
            <strong>{resolvedTickets}</strong>
          </div>

          <div>
            <span>SLA Breaches</span>
            <strong>{breachedTickets}</strong>
          </div>
        </div>
      </section>
    </>
  );
}




/* =========================
   KNOWLEDGE BASE
========================= */

function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showAddArticle, setShowAddArticle] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);

  const [newArticle, setNewArticle] = useState({
    title: "",
    category: "Hardware",
    content: "",
    keywords: "",
    external_url: ""
  });

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const currentRole = String(
    storedUser.role || localStorage.getItem("role") || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const canAddArticle = ["admin", "it_staff"].includes(
  String(currentRole || "").toLowerCase()
);

  // Load Knowledge Base articles
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        if (query.trim()) params.set("q", query.trim());
        if (category !== "All") params.set("category", category);

        const response = await fetch(
          `http://localhost:5001/api/knowledge-base?${params}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load articles.");
        }

        if (!cancelled) {
          setArticles(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Unable to load articles.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, category]);

  // Add a new article
  const handleAddArticle = async (e) => {
    e.preventDefault();

    if (!newArticle.title.trim() || !newArticle.content.trim()) {
      setError("Please enter an article title and instructions.");
      return;
    }

    try {
      setSavingArticle(true);
      setError("");

      const response = await fetch(
        "http://localhost:5001/api/knowledge-base",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(newArticle)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save article.");
      }

      setArticles(prev => [
        {
          ...data,
          type: "local",
          source: data.external_url
            ? "External Support"
            : "Local Knowledge Base",
          url: data.url || data.external_url || null
        },
        ...prev
      ]);

      setNewArticle({
        title: "",
        category: "Hardware",
        content: "",
        keywords: "",
        external_url: ""
      });

      setShowAddArticle(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setSavingArticle(false);
    }
  };

  // Official guide fallback
  const getOfficialGuide = (title = "") => {
    const t = title.toLowerCase();

    if (t.includes("screen") || t.includes("black"))
      return "https://support.microsoft.com/search/results?query=black%20screen";

    if (t.includes("wifi") || t.includes("wi-fi") || t.includes("network"))
      return "https://support.microsoft.com/search/results?query=network%20connection%20problems";

    if (t.includes("password") || t.includes("account"))
      return "https://support.microsoft.com/search/results?query=password%20reset";

    if (t.includes("printer"))
      return "https://support.microsoft.com/search/results?query=printer%20problems";

    return null;
  };

  const categories = [
    "All",
    "Hardware",
    "Network",
    "Account",
    "Software",
    "General"
  ];

  return (
    <div className="page">

      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div>
            <h2>Knowledge Base</h2>
            <p>Search troubleshooting guides before creating a ticket.</p>
          </div>

          {canAddArticle && (
            <button
              className="add-article-btn"
              onClick={() => setShowAddArticle(true)}
            >
              Add Article
            </button>
          )}
        </div>
      </div>

      {/* Search and Categories */}
      <div className="panel kb-search-panel">
        <div className="search-box kb-search">
          <Search size={18} className="search-icon" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search articles, issues, or keywords..."
          />
        </div>

        <div className="kb-categories">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`kb-chip ${category === c ? "is-active" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="error-text">{error}</p>
      )}

      {/* Article Cards */}
      {loading ? (
        <div className="empty-state">Loading articles…</div>
      ) : (
        <div className="kb-grid">
          {articles.map(article => {
            const hasExternalLink = Boolean(
              article.url || article.external_url
            );
            const isExternal = article.type === "external" || hasExternalLink;

            return (
              <button
                type="button"
                className="article-card"
                key={`${article.type || "local"}-${article.id}`}
                onClick={() => setSelected(article)}
              >
                <div className="article-card-top">
                  <span className="article-category">
                    {article.category}
                  </span>

                  <span className={`article-type ${isExternal ? "is-external" : ""}`}>
                    {isExternal ? "EXTERNAL" : "LOCAL"}
                  </span>
                </div>

                <h3>{article.title}</h3>

                <p>{article.content}</p>

                <span className="article-read">Read guide →</span>
              </button>
            );
          })}

          {!articles.length && (
            <div className="empty-state">No articles found. Try another search.</div>
          )}
        </div>
      )}

      {/* Article Details Modal */}
        {selected && createPortal(
            (
            <div
              role="dialog"
              aria-modal="true"
              className="modal-overlay kb-article-overlay"
              onClick={() => setSelected(null)}
            >
          <div
            className="modal-card kb-article-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="article-category">
                  {selected.category}
                </span>

                <h2>{selected.title}</h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="kb-article-body">
              {selected.content}
            </div>

            {/* External Support Link */}
            {(selected.url ||
              selected.external_url ||
              getOfficialGuide(selected.title)) && (
              <a
                className="primary-btn kb-guide-link"
                href={
                  selected.url ||
                  selected.external_url ||
                  getOfficialGuide(selected.title)
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Read Official Guide ↗
              </a>
            )}
          </div>
            </div>
  ),
  document.body
)}

      {/* Add Article Modal */}
      {showAddArticle && createPortal(
        (
          <div
            className="article-modal-overlay add-article-overlay"
            onClick={() => setShowAddArticle(false)}
          >
          <div
            className="article-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="article-modal-header">
              <div>
                <h2>Add Knowledge Article</h2>
                <p>Create a new troubleshooting guide.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddArticle(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddArticle}>
              <label>Article Title</label>

              <input
                value={newArticle.title}
                onChange={e => setNewArticle({
                  ...newArticle,
                  title: e.target.value
                })}
                placeholder="Enter article title"
                required
              />

              <label>Category</label>

              <select
                value={newArticle.category}
                onChange={e => setNewArticle({
                  ...newArticle,
                  category: e.target.value
                })}
              >
                <option>Hardware</option>
                <option>Network</option>
                <option>Account</option>
                <option>Software</option>
                <option>Security</option>
                <option>General</option>
              </select>

              <label>Troubleshooting Instructions</label>

              <textarea
                value={newArticle.content}
                onChange={e => setNewArticle({
                  ...newArticle,
                  content: e.target.value
                })}
                placeholder="Write the troubleshooting steps..."
                rows={7}
                required
              />

              <label>Search Keywords</label>

              <input
                value={newArticle.keywords}
                onChange={e => setNewArticle({
                  ...newArticle,
                  keywords: e.target.value
                })}
                placeholder="e.g. wifi, internet, connection"
              />

              {/* External URL Field */}
              <label>External Support URL (optional)</label>

              <input
                type="url"
                value={newArticle.external_url}
                onChange={e => setNewArticle({
                  ...newArticle,
                  external_url: e.target.value
                })}
                placeholder="https://support.microsoft.com/..."
              />

              <div className="article-modal-actions">
                <button
                  type="button"
                  className="cancel-article-btn"
                  onClick={() => setShowAddArticle(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-article-btn"
                  disabled={savingArticle}
                >
                  {savingArticle ? "Saving..." : "Save Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ),
  document.body
)}

    </div>
  );
}

function SettingsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Settings</h2>
          <p>Configure your IT ServiceHub system</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <h3>General Settings</h3>

          <div className="setting-row">
            <div>
              <strong>System Name</strong>
              <span>Displayed throughout the application</span>
            </div>
            <input value="IT ServiceHub" readOnly />
          </div>

          <div className="setting-row">
            <div>
              <strong>Default Ticket Priority</strong>
              <span>Priority assigned to new tickets</span>
            </div>
            <select defaultValue="Medium">
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </section>

        <section className="panel">
          <h3>Notifications</h3>

          <ToggleSetting
            title="SLA Breach Alerts"
            description="Notify managers when tickets breach SLA"
          />
          <ToggleSetting
            title="New Ticket Notifications"
            description="Notify support staff about new tickets"
          />
          <ToggleSetting
            title="Ticket Assignment"
            description="Notify staff when a ticket is assigned"
          />
        </section>
      </div>
    </>
  );
}

function ToggleSetting({ title, description }) {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="toggle-row">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <button
        className={`toggle ${enabled ? "on" : ""}`}
        onClick={() => setEnabled(!enabled)}
      >
        <span></span>
      </button>
    </div>
  );
}

export default App;