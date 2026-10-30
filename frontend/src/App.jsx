import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { LoadingScreen } from "./components/ui/Feedback";
import { useAuth, roleHome } from "./contexts/AuthContext";

import Home from "./pages/Home";
import Therapists from "./pages/Therapists";
import TherapistDetail from "./pages/TherapistDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterTherapist from "./pages/RegisterTherapist";
import Packs from "./pages/Packs";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

import PatientDashboard from "./pages/patient/PatientDashboard";
import Questionnaire from "./pages/patient/Questionnaire";
import Book from "./pages/patient/Book";
import PatientSessions from "./pages/patient/PatientSessions";
import Mood from "./pages/patient/Mood";
import Payments from "./pages/patient/Payments";
import Messages from "./pages/messaging/Messages";
import PatientFeedback from "./pages/patient/PatientFeedback";
import PatientSettings from "./pages/patient/PatientSettings";

import TherapistDashboard from "./pages/therapist/TherapistDashboard";
import Agenda from "./pages/therapist/Agenda";
import Requests from "./pages/therapist/Requests";
import TherapistPatients from "./pages/therapist/TherapistPatients";
import PatientDetail from "./pages/therapist/PatientDetail";
import TherapistSessions from "./pages/therapist/TherapistSessions";
import Reviews from "./pages/therapist/Reviews";
import TherapistSettings from "./pages/therapist/TherapistSettings";

import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import AdminTherapists from "./pages/admin/AdminTherapists";
import AdminSessions from "./pages/admin/AdminSessions";
import AdminPayments from "./pages/admin/AdminPayments";
import Complaints from "./pages/admin/Complaints";
import AdminSettings from "./pages/admin/AdminSettings";

function RoleRedirect() {
  const { isAuthenticated, loading, role } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={isAuthenticated ? roleHome(role) : "/connexion"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="/therapeutes" element={<Therapists />} />
        <Route path="/therapeutes/:id" element={<TherapistDetail />} />
        <Route path="/packs" element={<Packs />} />
        <Route path="/a-propos" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/inscription/therapeute" element={<RegisterTherapist />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute roles={["patient"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PatientDashboard />} />
        <Route path="questionnaire" element={<Questionnaire />} />
        <Route path="reserver" element={<Book />} />
        <Route path="seances" element={<PatientSessions />} />
        <Route path="humeur" element={<Mood />} />
        <Route path="paiements" element={<Payments />} />
        <Route path="messages" element={<Messages />} />
        <Route path="retours" element={<PatientFeedback />} />
        <Route path="parametres" element={<PatientSettings />} />
      </Route>

      <Route
        path="/pro"
        element={
          <ProtectedRoute roles={["therapist"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TherapistDashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="demandes" element={<Requests />} />
        <Route path="patients" element={<TherapistPatients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="seances" element={<TherapistSessions />} />
        <Route path="messages" element={<Messages />} />
        <Route path="avis" element={<Reviews />} />
        <Route path="parametres" element={<TherapistSettings />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="utilisateurs" element={<Users />} />
        <Route path="therapeutes" element={<AdminTherapists />} />
        <Route path="seances" element={<AdminSessions />} />
        <Route path="paiements" element={<AdminPayments />} />
        <Route path="reclamations" element={<Complaints />} />
        <Route path="parametres" element={<AdminSettings />} />
      </Route>

      <Route path="/espace" element={<RoleRedirect />} />
    </Routes>
  );
}
