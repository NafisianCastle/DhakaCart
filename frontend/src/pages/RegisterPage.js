import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const RegisterPage = ({ onRegister }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        agreeToTerms: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });

        // Clear validation error when user starts typing
        if (validationErrors[name]) {
            setValidationErrors({
                ...validationErrors,
                [name]: null
            });
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.firstName.trim()) {
            errors.firstName = 'First name is required';
        }

        if (!formData.lastName.trim()) {
            errors.lastName = 'Last name is required';
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Email is invalid';
        }

        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (!formData.agreeToTerms) {
            errors.agreeToTerms = 'You must agree to the terms and conditions';
        }

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        setLoading(true);
        setError(null);
        setValidationErrors({});

        try {
            logger.info('User registration attempt', { email: formData.email });

            const response = await apiClient.post('/auth/register', {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                phone: formData.phone
            });

            const { user, token } = response.data;

            // Store token in localStorage
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));

            logger.info('User registration successful', { userId: user.id, email: user.email });

            // Call parent component's onRegister if provided
            if (onRegister) {
                onRegister(user);
            }

            // Redirect to home page
            navigate('/');

        } catch (err) {
            const errorMessage = err.message || 'Registration failed';
            setError(errorMessage);
            logger.error('User registration failed', {
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
        maxWidth: '32rem'
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

    const rowStyle = {
        display: 'flex',
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

    const errorInputStyle = {
        ...inputStyle,
        borderColor: '#dc2626'
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

    const fieldErrorStyle = {
        color: '#dc2626',
        fontSize: '0.75rem',
        marginTop: '0.25rem'
    };

    const checkboxContainerStyle = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem'
    };

    const checkboxStyle = {
        marginTop: '0.125rem'
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
                <h1 style={titleStyle}>Create Your Account</h1>

                {error && (
                    <div style={errorStyle}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={formStyle}>
                    <div style={rowStyle}>
                        <div style={{ flex: 1 }}>
                            <label htmlFor="firstName" style={labelStyle}>
                                First Name *
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                style={validationErrors.firstName ? errorInputStyle : inputStyle}
                                placeholder="Enter your first name"
                            />
                            {validationErrors.firstName && (
                                <div style={fieldErrorStyle}>{validationErrors.firstName}</div>
                            )}
                        </div>

                        <div style={{ flex: 1 }}>
                            <label htmlFor="lastName" style={labelStyle}>
                                Last Name *
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                style={validationErrors.lastName ? errorInputStyle : inputStyle}
                                placeholder="Enter your last name"
                            />
                            {validationErrors.lastName && (
                                <div style={fieldErrorStyle}>{validationErrors.lastName}</div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" style={labelStyle}>
                            Email Address *
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            style={validationErrors.email ? errorInputStyle : inputStyle}
                            placeholder="Enter your email"
                        />
                        {validationErrors.email && (
                            <div style={fieldErrorStyle}>{validationErrors.email}</div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="phone" style={labelStyle}>
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            style={inputStyle}
                            placeholder="Enter your phone number"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" style={labelStyle}>
                            Password *
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            style={validationErrors.password ? errorInputStyle : inputStyle}
                            placeholder="Create a password"
                        />
                        {validationErrors.password && (
                            <div style={fieldErrorStyle}>{validationErrors.password}</div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" style={labelStyle}>
                            Confirm Password *
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            style={validationErrors.confirmPassword ? errorInputStyle : inputStyle}
                            placeholder="Confirm your password"
                        />
                        {validationErrors.confirmPassword && (
                            <div style={fieldErrorStyle}>{validationErrors.confirmPassword}</div>
                        )}
                    </div>

                    <div style={checkboxContainerStyle}>
                        <input
                            type="checkbox"
                            id="agreeToTerms"
                            name="agreeToTerms"
                            checked={formData.agreeToTerms}
                            onChange={handleChange}
                            style={checkboxStyle}
                        />
                        <label htmlFor="agreeToTerms" style={{ ...labelStyle, marginBottom: 0, fontSize: '0.875rem' }}>
                            I agree to the{' '}
                            <Link to="/terms" style={linkStyle}>Terms of Service</Link>
                            {' '}and{' '}
                            <Link to="/privacy" style={linkStyle}>Privacy Policy</Link>
                        </label>
                    </div>
                    {validationErrors.agreeToTerms && (
                        <div style={fieldErrorStyle}>{validationErrors.agreeToTerms}</div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={buttonStyle}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div style={dividerStyle}>
                    <div style={dividerLineStyle}></div>
                    <span style={dividerTextStyle}>Or sign up with</span>
                </div>

                <button style={socialButtonStyle}>
                    <span>🔵</span>
                    Sign up with Google
                </button>

                <button style={socialButtonStyle}>
                    <span>📘</span>
                    Sign up with Facebook
                </button>

                <div style={linkContainerStyle}>
                    <p style={{ color: '#6b7280', margin: 0 }}>
                        Already have an account?{' '}
                        <Link to="/login" style={linkStyle}>
                            Sign in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;