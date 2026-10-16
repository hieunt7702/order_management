import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/ui/Toast';
import { useAuthStore } from './stores/authStore';

// Pages
import { LoginPage } from './pages/Auth/LoginPage';
import { DashboardPage } from './pages/Dashboard/page';
import { OrdersPage } from './pages/Orders/page';
import { ScanOrdersPage } from './pages/ScanOrders/page';
import { ImportsPage } from './pages/Imports/page';
import { ProductsPage } from './pages/Products/page';
import { InventoryPage } from './pages/Inventory/page';
import { SettlementsPage } from './pages/Settlements/page';
import { PurchaseReceiptsPage } from './pages/PurchaseReceipts/page';
import { SuppliersPage } from './pages/Suppliers/page';
import { SupplierDebtsPage } from './pages/SupplierDebts/page';
import { OrderReturnsPage } from './pages/OrderReturns/page';
import { ShopsPage } from './pages/Shops/page';
import { MembersPage } from './pages/Members/page';
import { AuditPage } from './pages/Audit/page';
import { SettingsPage } from './pages/Settings/page';

interface RouteProps {
  children: React.ReactElement;
}

// Auth Guard Component
const ProtectedRoute: React.FC<RouteProps> = ({ children }) => {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Login Guard (redirect if already logged in)
const PublicOnlyRoute: React.FC<RouteProps> = ({ children }) => {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public Login Route */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        {/* Protected App Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/scan" element={<ScanOrdersPage />} />
          <Route path="/imports" element={<ImportsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/order-returns" element={<OrderReturnsPage />} />
          <Route path="/purchase-receipts" element={<PurchaseReceiptsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/supplier-debts" element={<SupplierDebtsPage />} />
          <Route path="/settlements" element={<SettlementsPage />} />
          <Route path="/shops" element={<ShopsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
