// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

// Public (auth) pages
import Login from "./JWT/Login/Login";
import Signup from "./JWT/Signup/Signup";
import RequireAuth from "./JWT/RequireAuth";

// App pages
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";
import Result from "./Pages/Result/Result";
import Grades from "./Pages/Grades/Grades";
import ListExams from "./Pages/ListExams/ListExams";
import MainLayout from "./MainLayout";
import DarkLight from "./Components/DarkLight/DarkLight";

function App() {
    return (
        <Router>
            {/* Always available (top-right) */}
            <DarkLight />

            <Routes>
                {/* Public routes (no token needed) */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected area (everything below requires a valid token) */}
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
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
