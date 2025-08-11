import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";
import Result from "./Pages/Result/Result";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<UploadExam />} />
                <Route path="/Key" element={<KeyPage />} />
                <Route path="/Student" element={<UploadStudent />} />
                <Route path="/Correction" element={<Correction />} />
                <Route path="/result" element={<Result />} />              {/* supports ?student=... */}
                <Route path="/result/:submissionId" element={<Result />} />
            </Routes>
        </Router>
    );
}
export default App;
