import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import StudentDashboard from './StudentDashboard';
import CalendarPage from './CalendarPage';
import TeachersPage from './TeachersPage';
import ComingSoonPage from './ComingSoonPage';
import AdminDashboard from './AdminDashboard';
import AdminAttendancePage from './AdminAttendancePage';
import AdminFeedbackPage from './AdminFeedbackPage';
import StudentAttendancePage from './StudentAttendancePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-attendance" element={<AdminAttendancePage />} />
        <Route path="/admin-feedback" element={<AdminFeedbackPage />} />

        {/* Placeholder Routes */}
        <Route path="/attendance" element={<StudentAttendancePage />} />
        <Route path="/grades" element={<ComingSoonPage />} />
        <Route path="/feedback" element={<ComingSoonPage />} />
        <Route path="/courses" element={<ComingSoonPage />} />
        <Route path="/settings" element={<ComingSoonPage />} />
      </Routes>
    </Router>
  );
}

export default App;
