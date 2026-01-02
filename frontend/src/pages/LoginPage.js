import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const LoginPage = ({ onLogin }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            logger.info('User login attempt', { email: formData.email });

            const response = await apiClient.post('/auth/login', {
                email: formData.email,
                password: formData.password
            });

            const { user, token } = response.data;

            // Store token in localStorage
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));

            logger.info('User login successful', { userId: user.id, email: user.email });

            // Call parent component's onLogin if provided
            if (onLogin) {
                onLogin(user);
            }

            // Redirect to home page
            navigate('/');

        } catch (err) {
            const errorMessage = err.message || 'Login failed';
            setError(errorMessage);
            logger.error('User login failed', {
                email: formData.email,
                error: errorMessage
            });
        } finally {
            setLoading(false);
        }
    };

    const containerStyle = {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        padding: '1rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '28rem'
    };

    const titleStyle = {
        fontSize: '1.875rem',
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: '2rem'
    };

    const formStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
    };

    const labelStyle = {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.25rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        boxSizing: 'border-box'
    };

    const buttonStyle = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: loading ? '#9ca3af' : '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        marginTop: '0.5rem'
    };

    const errorStyle = {
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        marginBottom: '1rem'
    };

    const linkContainerStyle = {
        textAlign: 'center',
        marginTop: '1.5rem',
        fontSize: '0.875rem'
    };

    const linkStyle = {
        color: '#2563eb',
        textDecoration: 'none',
        fontWeight: '600'
    };

    const dividerStyle = {
        margin: '1.5rem 0',
        textAlign: 'center',
        position: 'relative'
    };

    const dividerLineStyle = {
        borderTop: '1px solid #e5e7eb',
        margin: '0 1rem'
    };

    const dividerTextStyle = {
        backgroundColor: 'white',
        color: '#6b7280',
        padding: '0 1rem',
        position: 'absolute',
        top: '-0.5rem',
        left: '50%',
        transform: 'translateX(-50%)'
    };

    const socialButtonStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        backgroundColor: 'white',
        color: '#374151',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h1 style={titleStyle}>Sign In to DhakaCart</h1>

                {error && (
                    <div style={errorStyle}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={formStyle}>
                    <div>
                        <label htmlFor="email" style={labelStyle}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                            placeholder="Enter your email"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" style={labelStyle}>
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={buttonStyle}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div style={dividerStyle}>
                    <div style={dividerLineStyle}></div>
                    <span style={dividerTextStyle}>Or continue with</span>
                </div>

                <button style={socialButtonStyle}>
                    <span>🔵</span>
                    Continue with Google
                </button>

                <button style={socialButtonStyle}>
                    <span>📘</span>
                    Continue with Facebook
                </button>

                <div style={linkContainerStyle}>
                    <p style={{ color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                        Don't have an account?{' '}
                        <Link to="/register" style={linkStyle}>
                            Sign up here
                        </Link>
                    </p>
                    <Link to="/forgot-password" style={linkStyle}>
                        Forgot your password?
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;