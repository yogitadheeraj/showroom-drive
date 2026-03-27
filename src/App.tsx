import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import UnsubscribePage from "./pages/UnsubscribePage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import BookingPage from "./pages/BookingPage.tsx";
import WalkinPage from "./pages/WalkinPage.tsx";
import TestDrivesPage from "./pages/TestDrivesPage.tsx";
import CommunicationsPage from "./pages/CommunicationsPage.tsx";
import LocationsPage from "./pages/LocationsPage.tsx";
import VehiclesPage from "./pages/VehiclesPage.tsx";
import UsersPage from "./pages/UsersPage.tsx";
import DataCenterPage from "./pages/DataCenterPage.tsx";
import WaitingBoardPage from "./pages/WaitingBoardPage.tsx";
import EnquiriesPage from "./pages/EnquiriesPage.tsx";
import ComparePage from "./pages/ComparePage.tsx";
import DealerOnboardingPage from "./pages/DealerOnboardingPage.tsx";
import DealerSettingsPage from "./pages/DealerSettingsPage.tsx";
import { ROUTE_ALLOWED_ROLES } from "@/constants/roles";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/walkin" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.WALKIN]}><WalkinPage /></ProtectedRoute>} />
            <Route path="/test-drives" element={<ProtectedRoute><TestDrivesPage /></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
            <Route path="/enquiries" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.ENQUIRIES]}><EnquiriesPage /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.LOCATIONS]}><LocationsPage /></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.VEHICLES]}><VehiclesPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.USERS]}><UsersPage /></ProtectedRoute>} />
            <Route path="/data-center" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.DATA_CENTER]}><DataCenterPage /></ProtectedRoute>} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.SETTINGS]}><DealerSettingsPage /></ProtectedRoute>} />
            <Route path="/dealer-onboarding" element={<DealerOnboardingPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/waiting-board" element={<WaitingBoardPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
