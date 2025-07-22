import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";
import UploadStudent from "./Pages/UploadStudent/UploadStudent";
import Correction from "./Pages/Correction/Correction";


function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<UploadExam />} />
            </Routes>
            <Routes>
                <Route path="/Key" element={<KeyPage />} />
            </Routes>
            <Routes>
                <Route path="/Student" element={<UploadStudent />} />
            </Routes>
            <Routes>
                <Route path="/Correction" element={<Correction />} />
            </Routes>
        </Router>
    );
}


export default App;
