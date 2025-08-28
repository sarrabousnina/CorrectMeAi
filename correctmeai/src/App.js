// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

// Public pages
import Login from "./JWT/Login/Login";
import Signup from "./JWT/Signup/Signup";
import HomePage from "./Pages/HomePage/HomePage"; // marketing

// Auth
import RequireAuth from "./JWT/RequireAuth";

// Protected pages
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";
import Result from "./Pages/Result/Result";
import Grades from "./Pages/Grades/Grades";
import ListExams from "./Pages/ListExams/ListExams";
import Dashboard from "./Pages/Dashboard/Dashboard";
import MainLayout from "./MainLayout";

// 🔹 NEW: import the chat page
// src/App.js
import ProfChat from "./Components/ProfChat/ProfChat";

function App() {
    return (
        <Router>
            <Routes>
                {/* Public marketing */}
                <Route path="/welcome" element={<HomePage />} />

                {/* Public auth */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected area */}
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
