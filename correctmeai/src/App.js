// App.tsx or App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";
import Result from "./Pages/Result/Result";
import Grades from "./Pages/Grades/Grades";
import ListExams from "./Pages/ListExams/ListExams"; // ⬅️ NEW

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<UploadExam />} />
                <Route path="/Key" element={<KeyPage />} />
                <Route path="/Student" element={<UploadStudent />} />
                <Route path="/Correction" element={<Correction />} />
                <Route path="/result" element={<Result />} />
                <Route path="/result/:submissionId" element={<Result />} />
                <Route path="/exam/:examId/grades" element={<Grades />} />
                <Route path="/ListExams" element={<ListExams />} />
            </Routes>
        </Router>
    );
}
export default App;
