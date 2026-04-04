import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await axios.post('http://localhost:3000/api/auth/google', {
                token: credentialResponse.credential
            });
            
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || "Login failed");
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <h2>Login to RescueNet</h2>
            
            {error && <p style={{ color: 'red' }}>{error}</p>}

            <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google Login Failed")}
                />
            </div>
            
            <p style={{ marginTop: '20px' }}>
                New here? <a href="/register">Register as a User/NGO/Volunteer</a>
            </p>
        </div>
    );
};

export default Login;
