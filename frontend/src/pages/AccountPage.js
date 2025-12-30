import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AccountPage = () => {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profileData, setProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateMessage, setUpdateMessage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const storedUser = localStorage.getItem('user');

            if (!token || !storedUser) {
                navigate('/login');
                return;
            }

            const userData = JSON.parse(storedUser);
            setUser(userData);
            setProfileData({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                email: userData.email || '',
                phone: userData.phone || ''
            });

            setLoading(false);
        } catch (err) {
            setError('Failed to load user data');
            setLoading(false);
        }
    };

    const handleProfileChange = (e) => {
        setProfileData({
            ...profileData,
            [e.target.name]: e.target.value
        });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({
            ...passwordData,
            [e.target.name]: e.target.value
        });
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        setUpdateMessage(null);

        try {
            const response = await apiClient.put('/auth/profile', profileData);
            const updatedUser = response.data.user;

            // Update localStorage
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);

            setUpdateMessage({ type: 'success', text: 'Profile updated successfully!' });
            logger.info('Profile updated successfully');
        } catch (err) {
            setUpdateMessage({ type: 'error', text: err.message || 'Failed to update profile' });
            logger.error('Profile update failed', { error: err.message });
        } finally {
            setUpdateLoading(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setUpdateMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        setUpdateLoading(true);
        setUpdateMessage(null);

        try {
            await apiClient.put('/auth/password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            setUpdateMessage({ type: 'success', text: 'Password updated successfully!' });
            logger.info('Password updated successfully');
        } catch (err) {
            setUpdateMessage({ type: 'error', text: err.message || 'Failed to update password' });
            logger.error('Password update failed', { error: err.message });
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        logger.info('User logged out');
        navigate('/');
    };

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '2rem 0'
    };

    const innerContainerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
    };

    const headerStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const titleStyle = {
        fontSize: '2rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const subtitleStyle = {
        color: '#6b7280',
        fontSize: '1rem'
    };

    const contentStyle = {
        display: 'grid',
        gridTemplateColumns: window.innerWidth >= 768 ? '250px 1fr' : '1fr',
        gap: '2rem'
    };

    const sidebarStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: 'fit-content'
    };

    const tabStyle = (isActive) => ({
        display: 'block',
        width: '100%',
        padding: '0.75rem 1rem',
        textAlign: 'left',
        border: 'none',
        backgroundColor: isActive ? '#2563eb' : 'transparent',
        color: isActive ? 'white' : '#374151',
        borderRadius: '0.375rem',
        marginBottom: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        textDecoration: 'none'
    });

    const mainContentStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const formStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '32rem'
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
        padding: '0.75rem 1.5rem',
        backgroundColor: updateLoading ? '#9ca3af' : '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: updateLoading ? 'not-allowed' : 'pointer',
        width: 'fit-content'
    };

    const logoutButtonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        width: 'fit-content'
    };

    const messageStyle = (type) => ({
        padding: '0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        marginBottom: '1rem',
        backgroundColor: type === 'success' ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`,
        color: type === 'success' ? '#166534' : '#dc2626'
    });

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Loading...</h2>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2 style={{ color: '#dc2626' }}>{error}</h2>
                        <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={innerContainerStyle}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>My Account</h1>
                    <p style={subtitleStyle}>
                        Welcome back, {user?.firstName} {user?.lastName}
                    </p>
                </div>

                <div style={contentStyle}>
                    {/* Sidebar Navigation */}
                    <div style={sidebarStyle}>
                        <button
                            onClick={() => setActiveTab('profile')}
                            style={tabStyle(activeTab === 'profile')}
                        >
                            👤 Profile Information
                        </button>
                        <button
                            onClick={() => setActiveTab('password')}
                            style={tabStyle(activeTab === 'password')}
                        >
                            🔒 Change Password
                        </button>
                        <Link
                            to="/orders"
                            style={tabStyle(false)}
                        >
                            📦 Order History
                        </Link>
                        <Link
                            to="/wishlist"
                            style={tabStyle(false)}
                        >
                            ❤️ Wishlist
                        </Link>
                        <Link
                            to="/addresses"
                            style={tabStyle(false)}
                        >
                            📍 Addresses
                        </Link>
                        <button
                            onClick={handleLogout}
                            style={{ ...tabStyle(false), color: '#dc2626', marginTop: '1rem' }}
                        >
                            🚪 Logout
                        </button>
                    </div>

                    {/* Main Content */}
                    <div style={mainContentStyle}>
                        {updateMessage && (
                            <div style={messageStyle(updateMessage.type)}>
                                {updateMessage.text}
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>
                                    Profile Information
                                </h2>
                                <form onSubmit={handleProfileUpdate} style={formStyle}>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label htmlFor="firstName" style={labelStyle}>
                                                First Name
                                            </label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                name="firstName"
                                                value={profileData.firstName}
                                                onChange={handleProfileChange}
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label htmlFor="lastName" style={labelStyle}>
                                                Last Name
                                            </label>
                                            <input
                                                type="text"
                                                id="lastName"
                                                name="lastName"
                                                value={profileData.lastName}
                                                onChange={handleProfileChange}
                                                style={inputStyle}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="email" style={labelStyle}>
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={profileData.email}
                                            onChange={handleProfileChange}
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="phone" style={labelStyle}>
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={profileData.phone}
                                            onChange={handleProfileChange}
                                            style={inputStyle}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={updateLoading}
                                        style={buttonStyle}
                                    >
                                        {updateLoading ? 'Updating...' : 'Update Profile'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {activeTab === 'password' && (
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>
                                    Change Password
                                </h2>
                                <form onSubmit={handlePasswordUpdate} style={formStyle}>
                                    <div>
                                        <label htmlFor="currentPassword" style={labelStyle}>
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            id="currentPassword"
                                            name="currentPassword"
                                            value={passwordData.currentPassword}
                                            onChange={handlePasswordChange}
                                            style={inputStyle}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="newPassword" style={labelStyle}>
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            name="newPassword"
                                            value={passwordData.newPassword}
                                            onChange={handlePasswordChange}
                                            style={inputStyle}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="confirmPassword" style={labelStyle}>
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            value={passwordData.confirmPassword}
                                            onChange={handlePasswordChange}
                                            style={inputStyle}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={updateLoading}
                                        style={buttonStyle}
                                    >
                                        {updateLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;