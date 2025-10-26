// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

// Public pages
import HomePage from "./Pages/HomePage/HomePage";
import Login from "./JWT/Login/Login";
import Signup from "./JWT/Signup/Signup";

// Auth
import RequireAuth from "./JWT/RequireAuth";

// Layout & Protected pages
import MainLayout from "./MainLayout";
import UploadExam from "./Pages/UploadExam/UploadExam";
import ListExams from "./Pages/ListExams/ListExams";
import Grades from "./Pages/Grades/Grades";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";
import Result from "./Pages/Result/Result";
import Dashboard from "./Pages/Dashboard/Dashboard";
import ProfChat from "./Components/ProfChat/ProfChat";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/welcome" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes (wrapped in MainLayout) */}
        <Route element={<MainLayout />}>
          <Route
            index
            element={
              <RequireAuth>
                <UploadExam />
              </RequireAuth>
            }
          />
          <Route
            path="/ListExams"
            element={
              <RequireAuth>
                <ListExams />
              </RequireAuth>
            }
          />
          <Route
            path="/grades"
            element={
              <RequireAuth>
                <Grades />
              </RequireAuth>
            }
          />
          <Route
            path="/Key"
            element={
              <RequireAuth>
                <KeyPage />
              </RequireAuth>
            }
          />
          <Route
            path="/Student"
            element={
              <RequireAuth>
                <UploadStudent />
              </RequireAuth>
            }
          />
          <Route
            path="/Correction"
            element={
              <RequireAuth>
                <Correction />
              </RequireAuth>
            }
          />
          <Route
            path="/result"
            element={
              <RequireAuth>
                <Result />
              </RequireAuth>
            }
          />
          <Route
            path="/result/:submissionId"
            element={
              <RequireAuth>
                <Result />
              </RequireAuth>
            }
          />
          <Route
            path="/exam/:examId/grades"
            element={
              <RequireAuth>
                <Grades />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/assistant"
            element={
              <RequireAuth>
                <ProfChat />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;