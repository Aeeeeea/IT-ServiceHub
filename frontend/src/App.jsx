import { useState, useEffect } from "react";

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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

        const response = await fetch("http://localhost:5001/api/tickets");
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

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.token, data.user);
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
          <Ticket size={30} />
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

useEffect(() => {
  localStorage.setItem(
    notificationStorageKey,
    JSON.stringify(readAlertIds)
  );
}, [readAlertIds]);
  const loadNotifications = async () => {
    if (!token) return;
    try {
      await fetch("http://localhost:5001/api/notifications/check-sla", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const response = await fetch("http://localhost:5001/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setNotifications(await response.json());
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000);
    return () => clearInterval(timer);
  }, [currentUser?.id]);

  const unreadNotifications = notifications.filter(n => !Number(n.is_read));

  const markAllNotificationsRead = async () => {
    try {
      await fetch("http://localhost:5001/api/notifications/read-all", {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(current => current.map(n => ({ ...n, is_read: 1 })));
    } catch (error) { console.error(error); }
  };

  const markNotificationRead = async (id) => {
    try {
      await fetch(`http://localhost:5001/api/notifications/${id}/read`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(current => current.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) { console.error(error); }
  };

  const userName = currentUser?.name || "User";
  const userRole = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
    : "Employee";

  const initials = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Filter urgent tickets for notification popover
  const urgentTickets = tickets.filter((ticket) => {
    if (!ticket.sla_deadline || ticket.status === "Resolved" || ticket.status === "Closed") {
      return false;
    }
    const deadline = parseDate(ticket.sla_deadline);
    if (!deadline) return false;
    const remainingHours = (deadline - new Date()) / (1000 * 60 * 60);
    return remainingHours <= 2;
  });
  const unreadTickets = urgentTickets.filter(
  (ticket) => !readAlertIds.includes(String(ticket.id))
);

useEffect(() => {
  localStorage.setItem(
    notificationStorageKey,
    JSON.stringify(readAlertIds)
  );
}, [readAlertIds]);

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/tickets", label: "Tickets", icon: Ticket },
    { path: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
    { path: "/sla", label: "SLA Management", icon: Clock3 },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/users", label: "Users", icon: Users },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Ticket size={24} />
          </div>
          <div>
            <h2>IT ServiceHub</h2>
            <span>Help Desk & SLA Analytics</span>
          </div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div className="sidebar-user-info">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </div>
          <button onClick={onLogout} title="Logout" className="logout-btn">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="topbar-title">
            <h1>IT ServiceHub</h1>
            <p>IT Help Desk performance overview</p>
          </div>

          <div className="topbar-right">
            {/* NOTIFICATION POPOVER */}
 {/* NOTIFICATION POPOVER */}
<div className="notification-wrapper">
  <button
    type="button"
    className={`notification-trigger ${showNotifications ? "is-open" : ""}`}
    title="Notifications"
    aria-label={`Notifications, ${unreadNotifications.length} unread`}
    aria-expanded={showNotifications}
    onClick={() => setShowNotifications((open) => !open)}
  >
    <Bell size={21} strokeWidth={2} />

    {unreadNotifications.length > 0 && (
      <span className="notification-count">
        {unreadNotifications.length > 99 ? "99+" : unreadNotifications.length}
      </span>
    )}
  </button>

  {showNotifications && (
    <>
      <button type="button" className="notification-backdrop" aria-label="Close notifications" onClick={() => setShowNotifications(false)} />
      <div className="notification-dropdown">
        <div className="notification-header">
          <div><strong>Notifications</strong><span>{unreadNotifications.length ? `${unreadNotifications.length} unread` : "You're all caught up"}</span></div>
          {unreadNotifications.length > 0 && <button type="button" className="notification-read-all" onClick={markAllNotificationsRead}>Mark all read</button>}
        </div>
        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <span className="notification-empty-icon"><Bell size={24} /></span>
              <strong>No notifications yet</strong>
              <p>Ticket updates and SLA reminders will appear here.</p>
            </div>
          ) : notifications.map(notification => (
            <Link
              key={notification.id}
              to={notification.ticket_id ? `/tickets/${notification.ticket_id}` : "/knowledge-base"}
              className={`notification-item ${!Number(notification.is_read) ? "is-unread" : ""}`}
              onClick={() => {
                if (!Number(notification.is_read)) markNotificationRead(notification.id);
                setShowNotifications(false);
              }}
            >
              <span className="notification-item-icon">
                {notification.type === "sla_approaching" ? <AlertTriangle size={17} /> : <Bell size={17} />}
              </span>
              <span className="notification-item-content">
                <span className="notification-item-title">{notification.title}</span>
                <span className="notification-item-description">{notification.message}</span>
                <span className="notification-item-meta">
                  {notification.ticket_number ? `${notification.ticket_number} · ` : ""}
                  {notification.created_at ? new Date(String(notification.created_at).replace(" ", "T") + (String(notification.created_at).includes("Z") ? "" : "Z")).toLocaleString() : ""}
                </span>
              </span>
              {!Number(notification.is_read) && <span className="notification-unread-dot" />}
            </Link>
          ))}
        </div>
        <div className="notification-footer"><span>IT ServiceHub</span><span>Ticket notifications</span></div>
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
            <Route path="/" element={<Dashboard tickets={tickets} />} />
            <Route
              path="/tickets"
              element={
                <Tickets
                  tickets={tickets}
                  setTickets={setTickets}
                  onDelete={onDelete}
                  isAdmin={currentUser?.role?.toLowerCase() === "admin"}
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
            <Route path="/knowledge-base" element={<KnowledgeBase />} />\n            <Route path="/sla" element={<SLAManagement tickets={tickets} />} />
            <Route path="/analytics" element={<Analytics tickets={tickets} />} />
            <Route
              path="/users"
              element={<UsersPage currentUser={currentUser} />}
            />
            <Route path="/reports" element={<Reports tickets={tickets} />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </section>
      </main>
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
  console.table(
  tickets.map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    sla_status: ticket.sla_status,
    sla_deadline: ticket.sla_deadline,
    sla_target_hours: ticket.sla_target_hours,
  }))
);
  console.log("DASHBOARD SLA DATA:", tickets);
  console.table(
    tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      sla_status: ticket.sla_status,
      sla_deadline: ticket.sla_deadline || ticket.due_date || ticket.sla_due_date,
      sla_target_hours: ticket.sla_target_hours,
    }))
  );

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

      <div className="stats-grid">
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
            <div><span>Within SLA</span><strong>{slaCounts.within}</strong></div>
          </div>

          <div className="sla-summary-card sla-summary-risk">
            <span className="sla-summary-icon"><Clock3 size={19} /></span>
            <div><span>At Risk</span><strong>{slaCounts.risk}</strong></div>
          </div>

          <div className="sla-summary-card sla-summary-breached">
            <span className="sla-summary-icon"><AlertTriangle size={19} /></span>
            <div><span>Breached</span><strong>{slaCounts.breached}</strong></div>
          </div>
          <div className="sla-summary-card sla-summary-no-sla">
            <span className="sla-summary-icon">
              <Circle size={19} />
            </span>
            <div>
              <span>No SLA</span>
              <strong>{ticketsWithoutSLA.length}</strong>
            </div>
          </div>
          <div className="sla-summary-card sla-summary-unknown">
            <span className="sla-summary-icon"><Circle size={19} /></span>
            <div><span>Unknown</span><strong>{slaCounts.unknown}</strong></div>
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

  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentError, setCommentError] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Assignment state
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  // Status state
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const ticket = tickets.find(
    (t) =>
      String(t.id) === String(id) ||
      String(t.ticket_number) === String(id)
  );

  const userRole = currentUser?.role?.toLowerCase() || "employee";
  const isAdmin = userRole === "admin";

  const isITStaff = [
    "it_staff",
    "it",
    "staff",
  ].includes(userRole);

  const isAssignedStaff =
    isITStaff &&
    ticket?.assigned_to != null &&
    currentUser?.id != null &&
    String(ticket.assigned_to) === String(currentUser.id);

  const canMarkAsDone = isAdmin || isAssignedStaff;

  // Load saved comments from the backend.
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

  // Load assignable users for administrators.
  useEffect(() => {
    let cancelled = false;

    const loadAssignableUsers = async () => {
      if (!isAdmin) {
        setAssignableUsers([]);
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

        const filteredUsers = users.filter((user) =>
          ["admin", "it_staff"].includes(user.role?.toLowerCase())
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

  // Keep the selected assignee synchronized with the ticket.
  useEffect(() => {
    if (ticket) {
      setSelectedAssignee(
        ticket.assigned_to != null ? String(ticket.assigned_to) : ""
      );
    }
  }, [ticket, ticket?.id, ticket?.assigned_to]);

  // Save a new comment.
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
        throw new Error("The comment was saved, but no comment data was returned.");
      }

      setComments((previous) => [...previous, data.comment]);
      setCommentText("");
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setPostingComment(false);
    }
  };

  // Assign or reassign the ticket.
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
            assigned_to: selectedAssignee ? Number(selectedAssignee) : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to assign ticket.");
      }

      if (!data.ticket) {
        throw new Error("The server did not return the updated ticket.");
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

  // Save the resolved status in the backend database.
  const handleMarkAsDone = async () => {
    if (!ticket || !canMarkAsDone || savingStatus) return;

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
            status: "Resolved",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resolve ticket.");
      }

      if (!data.ticket) {
        throw new Error("The server did not return the updated ticket.");
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

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white border border-slate-200 rounded-2xl shadow-sm mt-8">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ticket not found</h3>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 rounded-lg transition-colors shadow-sm"
          onClick={() => navigate("/tickets")}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="ticket-details-page min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      <div className="ticket-details-shell w-full max-w-none mx-auto bg-white border border-slate-200/80 shadow-sm rounded-2xl p-8">
        
        {/* Ticket Header & Action Buttons */}

{/* Ticket Header & Action Buttons */}
<div className="ticket-page-header">
  <div className="ticket-header-info">
    <div className="ticket-header-topline">
      <h2 className="ticket-header-number">
        Ticket #{ticket.ticket_number || ticket.id}
      </h2>

      <span
        className={`ticket-header-status ${
          ticket.status === "Resolved" || ticket.status === "Closed"
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
    {canMarkAsDone &&
      ticket.status !== "Resolved" &&
      ticket.status !== "Closed" && (
        <button
          type="button"
          onClick={handleMarkAsDone}
          disabled={savingStatus}
          className="ticket-header-done"
        >
          <CheckCircle2 size={16} />
          {savingStatus ? "Saving..." : "Mark as Done"}
        </button>
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
          <p role="alert" className="text-sm text-rose-600 mt-4 font-medium">
            {statusError}
          </p>
        )}
        {/* Description Card */}
        <div className="ticket-content-card ticket-description-card bg-slate-50/70 border border-slate-200/60 rounded-xl p-6">
          <h3 className="ticket-section-title text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">
            <span className="ticket-section-icon ticket-icon-blue">
              <FileText size={18} />
            </span>
            Description
          </h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            {ticket.description || "No description provided."}
          </p>
        </div>
        {/* Grid Layout: Left Content & Right Sidebar */}
       <div className="ticket-details-grid grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8"> 
          
          {/* Left Column: Description & Comments */}
          <div className="ticket-discussion-column">
            
            


          {/* Discussion & Updates Section */}
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
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </span>
            </div>

            {/* Comments Thread */}
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
                        .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6
                    }`}
                  >
                    {(c.user_name || "U").trim().charAt(0).toUpperCase()}
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

            {/* Error Message */}
            {commentError && (
              <p role="alert" className="discussion-error">
                <AlertTriangle size={16} />
                {commentError}
              </p>
            )}

            {/* Post Comment Form */}
            <form
              onSubmit={handleAddComment}
              className="discussion-form"
            >
              <label htmlFor="ticket-comment-input" className="discussion-input-label">
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

          {/* Right Column: Details Sidebar */}
          <div className="ticket-details-sidebar space-y-6">
            <div className="ticket-info-card ticket-details-card bg-slate-50/70 border border-slate-200/60 rounded-xl p-6 space-y-5 h-fit">
              <h3 className="ticket-section-title text-sm font-semibold text-slate-900 uppercase tracking-wider">
                <span className="ticket-section-icon ticket-icon-indigo"><Ticket size={18} /></span>
                Details
              </h3>

              <div className="space-y-4 text-sm">
                
                {/* Status */}
                <div className="ticket-meta-row flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="ticket-meta-label text-slate-500 font-medium"><CheckCircle2 size={15} /> Status</span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                    {ticket.status}
                  </span>
                </div>

                {/* Priority */}
                <div className="ticket-meta-row flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="ticket-meta-label text-slate-500 font-medium"><AlertTriangle size={15} /> Priority</span>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    ticket.priority?.toLowerCase() === 'critical' || ticket.priority?.toLowerCase() === 'high'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {ticket.priority}
                  </span>
                </div>

                {/* Category */}
                <div className="ticket-meta-row flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="ticket-meta-label text-slate-500 font-medium"><FileText size={15} /> Category</span>
                  <span className="font-semibold text-slate-800">
                    {ticket.category || "General"}
                  </span>
                </div>

                {/* Requester */}
                <div className="ticket-meta-row flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="ticket-meta-label text-slate-500 font-medium"><Users size={15} /> Requester</span>
                  <span className="font-semibold text-slate-800">
                    {ticket.requester_name || ticket.requester || "Unknown"}
                  </span>
                </div>

                {/* Assigned To */}

                {/* Assigned To */}
                <div className="ticket-meta-row ticket-assignment-row py-3 border-b border-slate-200/60">
                  {isAdmin ? (
                    <>
                      <div className="ticket-assignment-inline">
                        <span className="ticket-meta-label ticket-assignment-label">
                          <Users size={18} />
                          <span>Assigned To</span>
                        </span>

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
                      </div>

                      {loadingAssignees && (
                        <p className="text-xs text-slate-500">
                          Loading users...
                        </p>
                      )}

                      <div className="ticket-assignment-button-wrap">
                        <button
                          type="button"
                          onClick={handleSaveAssignment}
                          disabled={loadingAssignees || savingAssignment}
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
                          className="text-xs text-rose-600 m-0 font-medium"
                        >
                          {assignmentError}
                        </p>
                      )}

                      {assignmentMessage && (
                        <p className="text-xs text-emerald-600 m-0 font-medium">
                          {assignmentMessage}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="ticket-assignment-inline">
                      <span className="ticket-meta-label ticket-assignment-label">
                        <Users size={18} />
                        <span>Assigned To</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {ticket.assigned_to_name ||
                          ticket.assignedTo ||
                          "Unassigned"}
                      </span>
                    </div>
                  )}
                </div>


                {/* SLA Status */}
                <div className="ticket-meta-row ticket-sla-row flex justify-between items-center py-2">
                  <span className="ticket-meta-label text-slate-500 font-medium"><ShieldCheck size={15} /> SLA Status</span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-slate-100 text-slate-700 border-slate-200">
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

    const statusColors = {
      open: "#2563eb",
      new: "#2563eb",
      "in-progress": "#7c3aed",
      assigned: "#0891b2",
      pending: "#d97706",
      "on-hold": "#d97706",
      resolved: "#16a34a",
      closed: "#64748b",
      reopened: "#ea580c",
      unknown: "#64748b",
    };

    const color = statusColors[status] || "#64748b";

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          color,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: 0,
          fontSize: "13px",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            minWidth: "7px",
            borderRadius: "50%",
            backgroundColor: color,
          }}
        />
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

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hardware",
    priority: "Medium",
    assignedTo: "",
  });

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);

        const response = await fetch("http://localhost:5001/api/users");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load users.");
        }

        const assignableUsers = data.filter(
          (user) => user.role === "it_staff" || user.role === "admin"
        );

        setUsers(assignableUsers);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (currentUser?.role === "admin" || currentUser?.role === "it_staff") {
      loadUsers();
    }
  }, [currentUser]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      alert("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("http://localhost:5001/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          priority: form.priority,
          requester_id: currentUser?.id || null,
          assigned_to: form.assignedTo ? Number(form.assignedTo) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create ticket.");
      }

      setTickets((current) => [data.ticket || data, ...current]);
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
      <div className="page-heading">
        <div>
          <Link to="/tickets" className="back-link">
            <ArrowLeft size={16} />
            Back to Tickets
          </Link>

          <h2>Create Ticket</h2>
          <p>Create a new IT support request</p>
        </div>
      </div>

      <section className="panel form-panel">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
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

            <div className="form-group compact-ticket-field">
              <label>Requester</label>
              <input value={currentUser?.name || "Employee"} disabled />
            </div>

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

            {(currentUser?.role === "admin" ||
              currentUser?.role === "it_staff") && (
              <div className="form-group">
                <label>Assign To</label>
                <select
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={handleChange}
                  disabled={submitting || loadingUsers}
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
          </div>

         
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
      case "Within SLA":
      case "Met SLA":
        return "sla-within";
      case "At Risk":
        return "sla-risk";
      case "Breached":
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

                          const statusColors = {
                            open: "#2563eb",
                            new: "#2563eb",
                            "in-progress": "#7c3aed",
                            assigned: "#0891b2",
                            pending: "#d97706",
                            "on-hold": "#d97706",
                            resolved: "#16a34a",
                            closed: "#64748b",
                            reopened: "#ea580c",
                            unknown: "#64748b",
                          };

                          const color = statusColors[status] || "#64748b";

                          return (
                            <span
                              className={`ticket-label status-${status}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "7px",
                                color: color,
                                background: "transparent",
                                border: "none",
                                boxShadow: "none",
                                padding: 0,
                                fontSize: "13px",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                className="ticket-label-dot"
                                style={{
                                  display: "inline-block",
                                  width: "7px",
                                  height: "7px",
                                  minWidth: "7px",
                                  borderRadius: "50%",
                                  backgroundColor: color,
                                }}
                              />
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
    const ticketData = tickets || [];

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


const {
  ticketsWithSLA,
  slaCounts,
  completedSLATickets,
  slaCompliance,
} = calculateTicketMetrics(ticketData);

const breachedTickets = slaCounts.breached;


  const categories = ["Hardware", "Software", "Network", "Account", "Other"]
    .map((category) => ({
      name: category,
      value: ticketData.filter((ticket) => ticket.category === category).length,
    }))
    .filter((item) => item.value > 0);


const priorityData = ["Critical", "High", "Medium", "Low"].map(
  (priority) => {
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
  }
);



  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Analytics</h2>
          <p>Analyze IT support performance</p>
        </div>

        <select className="date-select">
          <option>All time</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
          <option>This year</option>
        </select>
      </div>

      <div className="analytics-cards">
        <div className="metric-card">
          <span>Total Tickets</span>
          <strong>{totalTickets}</strong>
          <small>Tickets in system</small>
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

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Tickets by Category</h3>
              <p>Distribution of support requests</p>
            </div>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>SLA Performance</h3>
              <p>Compliance by priority</p>
            </div>
          </div>


<div className="performance-list">
  {priorityData.map((item) => {
    const colors = {
      Critical: "#ef4444",
      High: "#f97316",
      Medium: "#eab308",
      Low: "#64748b",
    };

    return (
      <div className="performance-row" key={item.name}>
        <div className="performance-row-header">
          <div className="performance-label">
            <span
              className="performance-dot"
              style={{ backgroundColor: colors[item.name] }}
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
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Current Dataset</h3>
            <p>Live information from the SQLite database</p>
          </div>
        </div>

        <div className="dataset-summary">
          <div>
            <span>Total records</span>
            <strong>{totalTickets}</strong>
          </div>
          <div>
            <span>With SLA</span>
            <strong>{ticketsWithSLA.length}</strong>
          </div>
          <div>
            <span>SLA breaches</span>
            <strong>{breachedTickets}</strong>
          </div>
          <div>
            <span>Resolved</span>
            <strong>{resolvedTickets}</strong>
          </div>
        </div>
      </section>
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

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/api/users");
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
    const fetchUsers = async () => {
      try {
        setLoading(true);

        const response = await fetch("http://localhost:5001/api/users");
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

    fetchUsers();
  }, []);


  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // CREATE USER HANDLER
  const handleAddUser = async (e) => {
    e.preventDefault();

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
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://localhost:5001/api/users", {
        method: "POST",
        headers: headers,
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
      setForm({ name: "", email: "", password: "", role: "employee" });
      setShowAddUser(false);
      await loadUsers();
    } catch (error) {
      console.error("Failed to create user:", error);
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT USER HANDLER
  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `http://localhost:5001/api/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: headers,
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

  // DELETE USER HANDLER
  const handleDeleteUser = async (user) => {
    if (!user) return;

    if (user.id === currentUser?.id) {
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
            Authorization: `Bearer ${token}`,
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

  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.role}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="users-page-wrapper">
      <div className="page-heading">
        <div>
          <h2>Users</h2>
          <p>Manage employees and IT support staff</p>
        </div>

        <button className="primary-btn" onClick={() => setShowAddUser(true)}>
          <UserPlus size={18} />
          Add User
        </button>
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
                  .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;

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

                    {currentUser?.role === "admin" && (
                      <button
                        type="button"
                        title="Delete user"
                        className="delete-user-btn"
                        onClick={() => handleDeleteUser(user)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
                <select name="role" value={form.role} onChange={handleChange}>
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
      )}

      {/* EDIT USER MODAL */}
      {showEditUser && editingUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEditUser(false);
            setEditingUser(null);
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
                    setEditingUser({ ...editingUser, name: e.target.value })
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
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value })
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
  const getReportSlaStatus = (ticket) => {
  if (!hasSlaDeadline(ticket)) {
    return "No SLA";
  }

  return ticket.sla_status || getSlaCategory(ticket);
};
  const exportCSV = () => {
    if (ticketData.length === 0) {
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
    ];

    const rows = ticketData.map((ticket) => [
      ticket.ticket_number || "",
      ticket.title || "",
      ticket.category || "",
      ticket.priority || "",
      ticket.status || "",
      ticket.requester_name || "",
      ticket.assigned_to_name || "Unassigned",
      getReportSlaStatus(ticket),
      ticket.sla_target_hours || "",
      ticket.sla_deadline || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "IT-ServiceHub-Report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSLAReport = () => {
    if (ticketData.length === 0) {
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

    const rows = ticketData.map((ticket) => [
      ticket.ticket_number || "",
      ticket.priority || "",
      ticket.status || "",
      getReportSlaStatus(ticket),
      ticket.sla_target_hours || "",
      ticket.sla_deadline || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "IT-ServiceHub-SLA-Performance.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportTicketReport = () => {
    if (ticketData.length === 0) {
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
    ];

    const rows = ticketData.map((ticket) => [
      ticket.ticket_number || "",
      ticket.title || "",
      ticket.category || "",
      ticket.priority || "",
      ticket.status || "",
      ticket.requester_name || "",
      ticket.assigned_to_name || "Unassigned",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "IT-ServiceHub-Ticket-Performance.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportStaffReport = () => {
    if (ticketData.length === 0) {
      alert("No ticket data available for the staff report.");
      return;
    }

    const staffMap = {};

    ticketData.forEach((ticket) => {
      const staffName = ticket.assigned_to_name || "Unassigned";

      if (!staffMap[staffName]) {
        staffMap[staffName] = { total: 0, open: 0, resolved: 0 };
      }

      staffMap[staffName].total += 1;

      if (ticket.status === "Open" || ticket.status === "In Progress") {
        staffMap[staffName].open += 1;
      }

      if (ticket.status === "Resolved" || ticket.status === "Closed") {
        staffMap[staffName].resolved += 1;
      }
    });

    const headers = [
      "Staff Name",
      "Total Assigned Tickets",
      "Open Tickets",
      "Resolved Tickets",
    ];

    const rows = Object.entries(staffMap).map(([staffName, stats]) => [
      staffName,
      stats.total,
      stats.open,
      stats.resolved,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "IT-ServiceHub-Staff-Performance.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalTickets = ticketData.length;
  const openTickets = ticketData.filter(
    (ticket) => ticket.status === "Open" || ticket.status === "In Progress"
  ).length;

 const resolvedTickets = ticketData.filter(
  (ticket) => ticket.status === "Resolved" || ticket.status === "Closed"
).length;

const {
  ticketsWithSLA,
  ticketsWithoutSLA,
  slaCounts,
  slaCompliance,
} = calculateTicketMetrics(ticketData);

const breachedTickets = slaCounts.breached;
  const priorities = ["Critical", "High", "Medium", "Low"].map((priority) => ({
    name: priority,
    count: ticketData.filter((ticket) => ticket.priority === priority).length,
  }));

  const categories = ["Hardware", "Software", "Network", "Account", "Other"]
    .map((category) => ({
      name: category,
      count: ticketData.filter((ticket) => ticket.category === category).length,
    }))
    .filter((item) => item.count > 0);

  const staffPerformance = {};

  ticketData.forEach((ticket) => {
    const staffName = ticket.assigned_to_name || "Unassigned";

    if (!staffPerformance[staffName]) {
      staffPerformance[staffName] = { total: 0, open: 0, resolved: 0 };
    }

    staffPerformance[staffName].total += 1;

    if (ticket.status === "Open" || ticket.status === "In Progress") {
      staffPerformance[staffName].open += 1;
    }

    if (ticket.status === "Resolved" || ticket.status === "Closed") {
      staffPerformance[staffName].resolved += 1;
    }
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Reports</h2>
          <p>Generate IT service performance reports</p>
        </div>

        <button className="primary-btn" onClick={exportCSV}>
          Export CSV
        </button>
      </div>

      <div className="analytics-cards">
        <div className="metric-card">
          <span>Total Tickets</span>
          <strong>{totalTickets}</strong>
          <small>All ticket records</small>
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

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Ticket Performance Report</h3>
            <p>Ticket volume, status, priority, and assignment analysis</p>
          </div>

          <button className="primary-btn" onClick={exportTicketReport}>
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
              {ticketData.filter((ticket) => ticket.status === "Open").length}
            </strong>
          </div>
          <div>
            <span>In Progress</span>
            <strong>
              {
                ticketData.filter((ticket) => ticket.status === "In Progress")
                  .length
              }
            </strong>
          </div>
          <div>
            <span>Resolved</span>
            <strong>{resolvedTickets}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>SLA Performance Report</h3>
            <p>SLA compliance, deadlines, and breach analysis</p>
          </div>

          <button className="primary-btn" onClick={exportSLAReport}>
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
            <strong>
              {
                ticketsWithSLA.filter(
                  (ticket) => getSlaCategory(ticket) === "Within SLA"
                ).length
              }
            </strong>
          </div>
          <div>
            <span>At Risk</span>
            <strong>
              {
                ticketsWithSLA.filter(
                  (ticket) => getSlaCategory(ticket) === "At Risk"
                ).length
              }
            </strong>
          </div>
          <div>
            <span>Breached</span>
            <strong>{breachedTickets}</strong>
          </div>
        </div>
        <div>
          <span>Unknown</span>
          <strong>{slaCounts.unknown}</strong>
        </div>

        <div>
          <span>No SLA</span>
          <strong>{ticketsWithoutSLA.length}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Staff Performance Report</h3>
            <p>Ticket workload and resolution performance by staff</p>
          </div>

          <button className="primary-btn" onClick={exportStaffReport}>
            Export Staff Report
          </button>
        </div>

        <div className="report-data-list">
          {Object.entries(staffPerformance).map(([staffName, stats]) => (
            <div className="report-data-row" key={staffName}>
              <span>{staffName}</span>
              <strong>
                {stats.total} total · {stats.open} open · {stats.resolved}{" "}
                resolved
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Report Summary</h3>
            <p>Current IT service performance based on live ticket data</p>
          </div>
        </div>

        <div className="dataset-summary">
          <div>
            <span>Total records</span>
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
            <span>SLA breaches</span>
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
    keywords: ""
  });
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

const currentRole = String(
  storedUser.role || localStorage.getItem("role") || ""
)
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, "_");

const canAddArticle = ["admin", "staff", "it_staff"].includes(currentRole);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true); setError("");
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (category !== "All") params.set("category", category);
        const response = await fetch(`http://localhost:5001/api/knowledge-base?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load articles.");
        if (!cancelled) setArticles(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Unable to load articles.");
      } finally { if (!cancelled) setLoading(false); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, category]);

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
      { ...data, type: "local", source: "Local Knowledge Base", url: null },
      ...prev
    ]);

    setNewArticle({
      title: "",
      category: "Hardware",
      content: "",
      keywords: ""
    });

    setShowAddArticle(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setSavingArticle(false);
  }
};

  const categories = ["All", "Hardware", "Network", "Account", "Software", "General"];
  return (
    <div className="page">
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
        <Plus size={18} />
        Add Article
      </button>
    )}
  </div>

        
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #dbe1ea", borderRadius: 10, padding: "10px 14px" }}>
          <Search size={18}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles, issues, or keywords..." style={{ border: 0, outline: 0, flex: 1, minWidth: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {categories.map(c => <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #dbe1ea", background: category === c ? "#eef2ff" : "#fff", color: category === c ? "#4338ca" : "#475569", cursor: "pointer" }}>{c}</button>)}
        </div>
      </div>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {loading ? <p>Loading articles…</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
  
    
{articles.map(article => (
  <button
  className="article-card"
  key={`${article.type || "local"}-${article.id}`}
    onClick={() => setSelected(article)}
    style={{
      textAlign: "left",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 18,
      cursor: "pointer",
      color: "inherit"
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#6366f1" }}>
        {article.category}
      </span>

      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: article.type === "external" ? "#15803d" : "#64748b",
        background: article.type === "external" ? "#dcfce7" : "#f1f5f9",
        padding: "4px 8px",
        borderRadius: 6
      }}>
        {article.type === "external" ? "EXTERNAL" : "LOCAL"}
      </span>
    </div>

    <h3 style={{ margin: "12px 0 8px" }}>{article.title}</h3>

    <p style={{ color: "#64748b", fontSize: 13 }}>
      {article.content}
    </p>

    <span style={{ color: "#2563eb", fontWeight: 600, fontSize: 13 }}>
      Read guide →
    </span>
  </button>
))}

          {!articles.length && <p>No articles found. Try another search.</p>}
        </div>
      )}
      {selected && <div role="dialog" aria-modal="true" onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "min(650px,100%)", maxHeight: "80vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><span style={{ color: "#6366f1" }}>{selected.category}</span><h2>{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="Close"><X size={20}/></button></div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{selected.content}</div>
        </div>
      </div>}

{showAddArticle && (
  <div className="article-modal-overlay"
    onClick={() => setShowAddArticle(false)}>

    <div className="article-modal"
      onClick={e => e.stopPropagation()}>

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
            ...newArticle, title: e.target.value
          })}
          placeholder="Enter article title"
          required
        />

        <label>Category</label>
        <select
          value={newArticle.category}
          onChange={e => setNewArticle({
            ...newArticle, category: e.target.value
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
            ...newArticle, content: e.target.value
          })}
          placeholder="Write the troubleshooting steps..."
          rows={7}
          required
        />

        <label>Search Keywords</label>
        <input
          value={newArticle.keywords}
          onChange={e => setNewArticle({
            ...newArticle, keywords: e.target.value
          })}
          placeholder="e.g. wifi, internet, connection"
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