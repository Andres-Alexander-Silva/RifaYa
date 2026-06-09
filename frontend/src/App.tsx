import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

// Public + auth pages — cargadas siempre (livianas)
import Home from "@/pages/public/Home";
import RaffleLanding from "@/pages/public/RaffleLanding";
import TicketSearch from "@/pages/public/TicketSearch";
import Login from "@/pages/auth/Login";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

// Admin pages — code splitting: solo se cargan si el usuario es admin
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Raffles = lazy(() => import("@/pages/admin/Raffles"));
const RaffleDetail = lazy(() => import("@/pages/admin/RaffleDetail"));
const Payments = lazy(() => import("@/pages/admin/Payments"));
const DrawPage = lazy(() => import("@/pages/admin/DrawPage"));

function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/rifa/:slug" element={<RaffleLanding />} />
        <Route path="/rifa/:slug/buscar" element={<TicketSearch />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin (protected + lazy) */}
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Lazy>
                <AdminLayout />
              </Lazy>
            </PrivateRoute>
          }
        >
          <Route index element={<Lazy><Dashboard /></Lazy>} />
          <Route path="rifas" element={<Lazy><Raffles /></Lazy>} />
          <Route path="rifas/:id" element={<Lazy><RaffleDetail /></Lazy>} />
          <Route path="pagos" element={<Lazy><Payments /></Lazy>} />
          <Route path="rifas/:id/sorteo" element={<Lazy><DrawPage /></Lazy>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
