import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminDashboardPage = () => {
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('30d');
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAuth();
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (selectedPeriod) {
            fetchAnalytics();
        }
    }, [selectedPeriod]);

    const checkAdminAuth = () => {
        const token = localStorage.getItem('adminToken');
        const user = localStorage.getItem('adminUser');

        if (!token || !user) {
            navigate('/admin/login');
            return;
        }

        try {
            const userData = JSON.parse(user);
            if (userData.role !== 'admin') {
                navigate('/admin/login');
            }
        } catch (err) {
            navigate('/admin/login');
        }
    };

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await apiClient.get('/admin/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setStats(response.data.stats);
            logger.info('Dashboard stats loaded successfully');
        } catch (err) {
            setError('Failed to load dashboard data');
            logger.error('Dashboard stats fetch failed', { error: err.message });
        }
    };

    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await apiClient.get(`/admin/analytics/sales?period=${selectedPeriod}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setAnalytics(response.data.analytics);
            setLoading(false);
        } catch (err) {
            setError('Failed to load analytics data');
            setLoading(false);
            logger.error('Analytics fetch failed', { error: err.message });
        }
    };
    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        navigate('/admin/login');
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{ textAlign: 'center', color: '#dc2626' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '1rem'
    };

    const headerStyle = {
        backgroundColor: 'white',
        padding: '1rem 2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const titleStyle = {
        fontSize: '1.875rem',
        fontWeight: '700',
        color: '#111827',
        margin: 0
    };

    const navStyle = {
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
    };

    const navButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const logoutButtonStyle = {
        ...navButtonStyle,
        backgroundColor: '#dc2626'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    };

    const statValueStyle = {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.25rem'
    };

    const statLabelStyle = {
        fontSize: '0.875rem',
        color: '#6b7280',
        fontWeight: '500'
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h1 style={titleStyle}>Admin Dashboard</h1>
                <div style={navStyle}>
                    <button
                        onClick={() => navigate('/admin/products')}
                        style={navButtonStyle}
                    >
                        Products
                    </button>
                    <button
                        onClick={() => navigate('/admin/orders')}
                        style={navButtonStyle}
                    >
                        Orders
                    </button>
                    <button
                        onClick={() => navigate('/admin/users')}
                        style={navButtonStyle}
                    >
                        Users
                    </button>
                    <button
                        onClick={handleLogout}
                        style={logoutButtonStyle}
                    >
                        Logout
                    </button>
                </div>
            </div>
            {/* Stats Overview */}
            {stats && (
                <div style={gridStyle}>
                    <div style={cardStyle}>
                        <div style={statValueStyle}>{formatNumber(stats.overview.totalUsers)}</div>
                        <div style={statLabelStyle}>Total Users</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={statValueStyle}>{formatNumber(stats.overview.totalProducts)}</div>
                        <div style={statLabelStyle}>Total Products</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={statValueStyle}>{formatNumber(stats.overview.totalOrders)}</div>
                        <div style={statLabelStyle}>Total Orders</div>
                    </div>
                    <div style={cardStyle}>
                        <div style={statValueStyle}>{formatCurrency(stats.overview.totalRevenue)}</div>
                        <div style={statLabelStyle}>Total Revenue</div>
                    </div>
                </div>
            )}

            {/* Analytics Section */}
            <div style={cardStyle}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        Sales Analytics
                    </h2>
                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        style={{
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem'
                        }}
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                    </select>
                </div>

                {analytics && analytics.data && analytics.data.length > 0 ? (
                    <div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#3b82f6' }}>
                                    {formatNumber(analytics.data.reduce((sum, item) => sum + item.orderCount, 0))}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Orders</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#10b981' }}>
                                    {formatCurrency(analytics.data.reduce((sum, item) => sum + item.revenue, 0))}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Revenue</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f59e0b' }}>
                                    {formatCurrency(analytics.data.reduce((sum, item) => sum + item.avgOrderValue, 0) / analytics.data.length)}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Avg Order Value</div>
                            </div>
                        </div>

                        {/* Simple chart representation */}
                        <div style={{ marginTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                                Revenue Trend
                            </h3>
                            <div style={{
                                display: 'flex',
                                alignItems: 'end',
                                gap: '0.25rem',
                                height: '200px',
                                padding: '1rem',
                                backgroundColor: '#f9fafb',
                                borderRadius: '0.375rem'
                            }}>
                                {analytics.data.map((item, index) => {
                                    const maxRevenue = Math.max(...analytics.data.map(d => d.revenue));
                                    const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 150 : 0;

                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#3b82f6',
                                                height: `${height}px`,
                                                minHeight: '2px',
                                                borderRadius: '2px',
                                                position: 'relative',
                                                cursor: 'pointer'
                                            }}
                                            title={`${new Date(item.date).toLocaleDateString()}: ${formatCurrency(item.revenue)}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                        No analytics data available for the selected period
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div style={{ ...cardStyle, marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                    Quick Actions
                </h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    <button
                        onClick={() => navigate('/admin/products/new')}
                        style={{
                            padding: '1rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        ➕ Add New Product
                    </button>
                    <button
                        onClick={() => navigate('/admin/orders')}
                        style={{
                            padding: '1rem',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        📦 Manage Orders
                    </button>
                    <button
                        onClick={() => navigate('/admin/users')}
                        style={{
                            padding: '1rem',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        👥 Manage Users
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboardPage;