import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminLoginPage = () => {
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
            logger.info('Admin login attempt', { email: formData.email });

            const response = await apiClient.post('/auth/login', {
                email: formData.email,
                password: formData.password
            });

            const { user, token } = response.data;

            // Check if user is admin
            if (user.role !== 'admin') {
                throw new Error('Access denied. Admin privileges required.');
            }

            // Store token in localStorage
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminUser', JSON.stringify(user));

            logger.info('Admin login successful', { userId: user.id, email: user.email });

            // Redirect to admin dashboard
            navigate('/admin/dashboard');

        } catch (err) {
            const errorMessage = err.message || 'Login failed';
            setError(errorMessage);
            logger.error('Admin login failed', {
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
        backgroundColor: '#1f2937',
        padding: '1rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
        width: '100%',
        maxWidth: '28rem'
    };

    const titleStyle = {
        fontSize: '1.875rem',
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: '0.5rem'
    };

    const subtitleStyle = {
        fontSize: '0.875rem',
        color: '#6b7280',
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
        boxSizing: 'border-box',
        transition: 'border-color 0.2s'
    };

    const buttonStyle = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: loading ? '#9ca3af' : '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        marginTop: '0.5rem',
        transition: 'background-color 0.2s'
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

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔐</div>
                    <h1 style={titleStyle}>Admin Portal</h1>
                    <p style={subtitleStyle}>Sign in to access the admin dashboard</p>
                </div>

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
                            placeholder="admin@dhakacart.com"
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
                            placeholder="Enter your admin password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={buttonStyle}
                    >
                        {loading ? 'Signing In...' : 'Sign In to Admin Panel'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLoginPage;