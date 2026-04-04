import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [role, setRole] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        if (!role) {
            setError("Please select a role before registering.");
            return;
        }
        
        try {
            const res = await axios.post('http://localhost:3000/api/auth/google', {
                token: credentialResponse.credential,
                role: role
            });
            
            // Save token and user info
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || "An error occurred during registration");
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <h2>Register for RescueNet</h2>
            
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p>Select your Role:</p>
                <label>
                    <input type="radio" value="user" checked={role === 'user'} onChange={(e) => setRole(e.target.value)} />
                    User / Victim
                </label>
                <label>
                    <input type="radio" value="ngo" checked={role === 'ngo'} onChange={(e) => setRole(e.target.value)} />
                    NGO / Organization
                </label>
                <label>
                    <input type="radio" value="volunteer" checked={role === 'volunteer'} onChange={(e) => setRole(e.target.value)} />
                    Volunteer
                </label>
            </div>

            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google Login Failed")}
            />
            
            <p style={{ marginTop: '20px' }}>
                Already have an account? <a href="/login">Login here</a>
            </p>
        </div>
    );
};

export default Register;
