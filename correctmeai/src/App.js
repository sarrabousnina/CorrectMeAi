import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import UploadExam from "./Pages/UploadExam/UploadExam";
import KeyPage from "./Pages/KeyPage/KeyPage";


function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<UploadExam />} />
            </Routes>
            <Routes>
                <Route path="/Key" element={<KeyPage />} />
            </Routes>
        </Router>
    );
}


export default App;
