import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Register from './pages/Register';
import Login from './pages/Login';

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "placeholder_client_id.apps.googleusercontent.com"; // Fallback incase env is not set up

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<h2 style={{textAlign:'center', marginTop:'50px'}}>Welcome to the Dashboard!</h2>} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
