import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        role: '',
        isActive: '',
        page: 1,
        limit: 20
    });
    const [pagination, setPagination] = useState(null);
    const [updatingUser, setUpdatingUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAuth();
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [filters]);

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

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const queryParams = new URLSearchParams();

            Object.entries(filters).forEach(([key, value]) => {
                if (value !== '') queryParams.append(key, value);
            });

            const response = await apiClient.get(`/admin/users?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setUsers(response.data.users);
            setPagination(response.data.pagination);
            setLoading(false);
        } catch (err) {
            setError('Failed to load users');
            setLoading(false);
            logger.error('Users fetch failed', { error: err.message });
        }
    };

    const updateUserStatus = async (userId, isActive) => {
        setUpdatingUser(userId);
        try {
            const token = localStorage.getItem('adminToken');
            await apiClient.patch(`/admin/users/${userId}/status`,
                { isActive },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            // Update the user in the list
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, is_active: isActive }
                    : user
            ));

            logger.info('User status updated successfully', { userId, isActive });
        } catch (err) {
            setError('Failed to update user status');
            logger.error('User status update failed', { error: err.message, userId, isActive });
        } finally {
            setUpdatingUser(null);
        }
    };
    const updateUserRole = async (userId, role) => {
        setUpdatingUser(userId);
        try {
            const token = localStorage.getItem('adminToken');
            await apiClient.patch(`/admin/users/${userId}/role`,
                { role },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            // Update the user in the list
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, role }
                    : user
            ));

            logger.info('User role updated successfully', { userId, role });
        } catch (err) {
            setError('Failed to update user role');
            logger.error('User role update failed', { error: err.message, userId, role });
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: 1 // Reset to first page when filtering
        }));
    };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({
            ...prev,
            page: newPage
        }));
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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
                    <p>Loading users...</p>
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

    const backButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
    };

    const filtersStyle = {
        padding: '1.5rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        alignItems: 'end'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        boxSizing: 'border-box'
    };

    const tableStyle = {
        width: '100%',
        borderCollapse: 'collapse'
    };

    const thStyle = {
        padding: '0.75rem 1rem',
        textAlign: 'left',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
    };

    const tdStyle = {
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '0.875rem'
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h1 style={titleStyle}>User Management</h1>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    style={backButtonStyle}
                >
                    ← Back to Dashboard
                </button>
            </div>

            {error && (
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem'
                }}>
                    {error}
                </div>
            )}

            {/* Users Table */}
            <div style={cardStyle}>
                {/* Filters */}
                <div style={filtersStyle}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Search Users
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Role
                        </label>
                        <select
                            value={filters.role}
                            onChange={(e) => handleFilterChange('role', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">All Roles</option>
                            <option value="customer">Customer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Status
                        </label>
                        <select
                            value={filters.isActive}
                            onChange={(e) => handleFilterChange('isActive', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">All Statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Items per page
                        </label>
                        <select
                            value={filters.limit}
                            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                            style={inputStyle}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Phone</th>
                                <th style={thStyle}>Role</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Email Verified</th>
                                <th style={thStyle}>Joined</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length > 0 ? users.map(user => (
                                <tr key={user.id}>
                                    <td style={tdStyle}>
                                        <div>
                                            <div style={{ fontWeight: '500' }}>
                                                {user.first_name} {user.last_name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                ID: {user.id}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        {user.email}
                                    </td>
                                    <td style={tdStyle}>
                                        {user.phone || 'N/A'}
                                    </td>
                                    <td style={tdStyle}>
                                        <select
                                            value={user.role}
                                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                                            disabled={updatingUser === user.id}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                backgroundColor: user.role === 'admin' ? '#fef3c7' : '#dbeafe',
                                                color: user.role === 'admin' ? '#92400e' : '#1e40af'
                                            }}
                                        >
                                            <option value="customer">Customer</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => updateUserStatus(user.id, !user.is_active)}
                                            disabled={updatingUser === user.id}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                border: 'none',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                cursor: updatingUser === user.id ? 'not-allowed' : 'pointer',
                                                backgroundColor: user.is_active ? '#d1fae5' : '#fee2e2',
                                                color: user.is_active ? '#065f46' : '#991b1b'
                                            }}
                                        >
                                            {updatingUser === user.id ? 'Updating...' : (user.is_active ? 'Active' : 'Inactive')}
                                        </button>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            backgroundColor: user.email_verified ? '#d1fae5' : '#fef3c7',
                                            color: user.email_verified ? '#065f46' : '#92400e'
                                        }}>
                                            {user.email_verified ? 'Verified' : 'Unverified'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {formatDate(user.created_at)}
                                    </td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => navigate(`/admin/users/${user.id}/orders`)}
                                            style={{
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '0.25rem',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: '500'
                                            }}
                                        >
                                            View Orders
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '2rem' }}>
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div style={{
                        padding: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                            {pagination.total} users
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    backgroundColor: pagination.hasPrev ? 'white' : '#f9fafb',
                                    color: pagination.hasPrev ? '#374151' : '#9ca3af',
                                    cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Previous
                            </button>
                            <span style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                color: '#374151'
                            }}>
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasNext}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    backgroundColor: pagination.hasNext ? 'white' : '#f9fafb',
                                    color: pagination.hasNext ? '#374151' : '#9ca3af',
                                    cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsersPage;