import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { ThemeProvider } from "@/hooks/useTheme";
import MobileLayout from "@/components/MobileLayout";
import AuthPage from "./pages/AuthPage";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import IssuesPage from "./pages/IssuesPage";
import SettingsPage from "./pages/SettingsPage";
import ApplicantsPage from "./pages/ApplicantsPage";
import NotificationsPage from "./pages/NotificationsPage";
import CalendarPage from "./pages/CalendarPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <MobileLayout>{children}</MobileLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (user) return <Navigate to="/properties" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/properties" replace />} />
                <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
                <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
                <Route path="/properties/:id" element={<ProtectedRoute><PropertyDetailPage /></ProtectedRoute>} />
                <Route path="/applicants" element={<ProtectedRoute><ApplicantsPage /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
