import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import GroupView from "./pages/GroupView";
import PlaceOrder from "./pages/public/PlaceOrder";
import TrackOrder from "./pages/public/TrackOrder";
import AdminOrders from "./pages/admin/Orders";
import OrderDetail from "./pages/admin/OrderDetail";
import Captains from "./pages/admin/Captains";
import AdminPosts from "./pages/admin/Posts";
import Dashboard from "./pages/captain/Dashboard";
import TaskDetail from "./pages/captain/TaskDetail";
import Roster from "./pages/captain/Roster";
import CaptainFeed from "./pages/captain/Feed";

const ADMIN_NAV = [
  { to: "/admin/orders", icon: "orders" },
  { to: "/admin/captains", icon: "captains" },
  { to: "/admin/posts", icon: "posts" },
];
const CAPTAIN_NAV = [
  { to: "/captain", icon: "tasks", end: true },
  { to: "/captain/feed", icon: "feed" },
  { to: "/captain/group", icon: "group" },
];

const AdminShell = () => <Layout nav={ADMIN_NAV} wide><Outlet /></Layout>;
const CaptainShell = () => <Layout nav={CAPTAIN_NAV}><Outlet /></Layout>;

function NotFound() {
  const { t } = useTranslation();
  return <Layout><p className="center muted">{t("common.notFound")}</p></Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/order" element={<PlaceOrder />} />
      <Route path="/track/:token" element={<TrackOrder />} />
      <Route path="/g/:code" element={<GroupView />} />
      <Route path="/login" element={<Login />} />

      <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="captains" element={<Captains />} />
        <Route path="posts" element={<AdminPosts />} />
      </Route>

      <Route path="/captain" element={<ProtectedRoute roles={["leader"]}><CaptainShell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="tasks/:id" element={<TaskDetail />} />
        <Route path="feed" element={<CaptainFeed />} />
        <Route path="group" element={<Roster />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
