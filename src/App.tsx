// @ts-nocheck
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Stagiaires from "./pages/Stagiaires";
import Formations from "./pages/Formations";
import Incidents from "./pages/Incidents";
import Planning from "./pages/Planning";
import Formateurs from "./pages/Formateurs";
import Utilisateurs from "./pages/Utilisateurs";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import EspaceStagiaire from "./pages/EspaceStagiaire";
import EspaceFormateur from "./pages/EspaceFormateur";
import EspaceRH from "@/pages/EspaceRH";
import QuestionnairePublic from "./pages/QuestionnairePublic";
import Competences from "./pages/Competences";
import Audit from "./pages/Audit";
import AdminCours from "./pages/AdminCours";
import AdminMessages from "./pages/AdminMessages";
import Rappels from "./pages/Rappels";
import Reclamations from "./pages/Reclamations";
import Entreprises from "./pages/Entreprises";
import Documents from "./pages/Documents";
import Statistiques from "./pages/Statistiques";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stagiaires" element={<Stagiaires />} />
              <Route path="/formations" element={<Formations />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/formateurs" element={<Formateurs />} />
              <Route path="/utilisateurs" element={<Utilisateurs />} />
              <Route path="/competences" element={<Competences />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/cours" element={<AdminCours />} />
              <Route path="/messagerie-admin" element={<AdminMessages />} />
              <Route path="/rappels" element={<Rappels />} />
              <Route path="/reclamations" element={<Reclamations />} />
              <Route path="/entreprises" element={<Entreprises />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/statistiques" element={<Statistiques />} />
            </Route>
            <Route path="/espace-stagiaire" element={<EspaceStagiaire />} />
            <Route path="/espace-formateur" element={<EspaceFormateur />} />
            <Route path="/espace-rh" element={<EspaceRH />} />
            <Route path="/q/:token" element={<QuestionnairePublic />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;