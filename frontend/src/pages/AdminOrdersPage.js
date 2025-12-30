import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminOrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        paymentStatus: '',
        page: 1,
        limit: 20
    });
    const [pagination, setPagination] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAuth();
        fetchOrders();
    }, []);

    useEffect(() => {
        fetchOrders();
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

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const queryParams = new URLSearchParams();

            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });

            const response = await apiClient.get(`/admin/orders?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setOrders(response.data.orders);
            setPagination(response.data.pagination);
            setLoading(false);
        } catch (err) {
            setError('Failed to load orders');
            setLoading(false);
            logger.error('Orders fetch failed', { error: err.message });
        }
    };

    const fetchOrderDetails = async (orderId) => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await apiClient.get(`/admin/orders/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setSelectedOrder(response.data.order);
            setShowOrderModal(true);
        } catch (err) {
            setError('Failed to load order details');
            logger.error('Order details fetch failed', { error: err.message, orderId });
        }
    };
    const updateOrderStatus = async (orderId, newStatus) => {
        setUpdatingStatus(true);
        try {
            const token = localStorage.getItem('adminToken');
            await apiClient.patch(`/admin/orders/${orderId}/status`,
                { status: newStatus },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            // Update the order in the list
            setOrders(orders.map(order =>
                order.id === orderId
                    ? { ...order, status: newStatus }
                    : order
            ));

            // Update selected order if it's the same
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }

            logger.info('Order status updated successfully', { orderId, newStatus });
        } catch (err) {
            setError('Failed to update order status');
            logger.error('Order status update failed', { error: err.message, orderId, newStatus });
        } finally {
            setUpdatingStatus(false);
        }
    };

    const updatePaymentStatus = async (orderId, newPaymentStatus) => {
        setUpdatingStatus(true);
        try {
            const token = localStorage.getItem('adminToken');
            await apiClient.patch(`/admin/orders/${orderId}/payment-status`,
                { paymentStatus: newPaymentStatus },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            // Update the order in the list
            setOrders(orders.map(order =>
                order.id === orderId
                    ? { ...order, payment_status: newPaymentStatus }
                    : order
            ));

            // Update selected order if it's the same
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder({ ...selectedOrder, payment_status: newPaymentStatus });
            }

            logger.info('Payment status updated successfully', { orderId, newPaymentStatus });
        } catch (err) {
            setError('Failed to update payment status');
            logger.error('Payment status update failed', { error: err.message, orderId, newPaymentStatus });
        } finally {
            setUpdatingStatus(false);
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: { bg: '#fef3c7', text: '#92400e' },
            processing: { bg: '#dbeafe', text: '#1e40af' },
            shipped: { bg: '#d1fae5', text: '#065f46' },
            delivered: { bg: '#dcfce7', text: '#166534' },
            cancelled: { bg: '#fee2e2', text: '#991b1b' }
        };
        return colors[status] || { bg: '#f3f4f6', text: '#374151' };
    };

    const getPaymentStatusColor = (status) => {
        const colors = {
            pending: { bg: '#fef3c7', text: '#92400e' },
            paid: { bg: '#d1fae5', text: '#065f46' },
            failed: { bg: '#fee2e2', text: '#991b1b' },
            refunded: { bg: '#e0e7ff', text: '#3730a3' }
        };
        return colors[status] || { bg: '#f3f4f6', text: '#374151' };
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
                    <p>Loading orders...</p>
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
                <h1 style={titleStyle}>Order Management</h1>
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
            {/* Orders Table */}
            <div style={cardStyle}>
                {/* Filters */}
                <div style={filtersStyle}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Search Orders
                        </label>
                        <input
                            type="text"
                            placeholder="Search by order number or customer..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Order Status
                        </label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Payment Status
                        </label>
                        <select
                            value={filters.paymentStatus}
                            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">All Payment Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
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
                                <th style={thStyle}>Order #</th>
                                <th style={thStyle}>Customer</th>
                                <th style={thStyle}>Items</th>
                                <th style={thStyle}>Total</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Payment</th>
                                <th style={thStyle}>Date</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length > 0 ? orders.map(order => {
                                const statusColor = getStatusColor(order.status);
                                const paymentColor = getPaymentStatusColor(order.payment_status);

                                return (
                                    <tr key={order.id}>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: '500' }}>
                                                #{order.order_number}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div>
                                                <div style={{ fontWeight: '500' }}>
                                                    {order.user_first_name} {order.user_last_name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                    {order.user_email}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: '500' }}>
                                                {formatCurrency(order.total_amount)}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                backgroundColor: statusColor.bg,
                                                color: statusColor.text
                                            }}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                backgroundColor: paymentColor.bg,
                                                color: paymentColor.text
                                            }}>
                                                {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {formatDate(order.created_at)}
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => fetchOrderDetails(order.id)}
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
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '2rem' }}>
                                        No orders found
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
                            {pagination.total} orders
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
            {/* Order Details Modal */}
            {showOrderModal && selectedOrder && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '0.5rem',
                        maxWidth: '800px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                                Order #{selectedOrder.order_number}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowOrderModal(false);
                                    setSelectedOrder(null);
                                }}
                                style={{
                                    padding: '0.5rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: '1.5rem',
                                    color: '#6b7280'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ padding: '1.5rem' }}>
                            {/* Customer Information */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                    Customer Information
                                </h4>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    <p><strong>Name:</strong> {selectedOrder.user_first_name} {selectedOrder.user_last_name}</p>
                                    <p><strong>Email:</strong> {selectedOrder.user_email}</p>
                                    {selectedOrder.user_phone && (
                                        <p><strong>Phone:</strong> {selectedOrder.user_phone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Order Status Management */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                    Order Status
                                </h4>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <select
                                        value={selectedOrder.status}
                                        onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                                        disabled={updatingStatus}
                                        style={{
                                            padding: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="processing">Processing</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                    <select
                                        value={selectedOrder.payment_status}
                                        onChange={(e) => updatePaymentStatus(selectedOrder.id, e.target.value)}
                                        disabled={updatingStatus}
                                        style={{
                                            padding: '0.5rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        <option value="pending">Payment Pending</option>
                                        <option value="paid">Paid</option>
                                        <option value="failed">Failed</option>
                                        <option value="refunded">Refunded</option>
                                    </select>
                                    {updatingStatus && (
                                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                            Updating...
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                    Order Items
                                </h4>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}>
                                    {selectedOrder.items && selectedOrder.items.map((item, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '1rem',
                                                borderBottom: index < selectedOrder.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{item.product_name}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                    Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: '500' }}>
                                                {formatCurrency(item.total_price)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                    Order Summary
                                </h4>
                                <div style={{
                                    backgroundColor: '#f9fafb',
                                    padding: '1rem',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Subtotal:</span>
                                        <span>{formatCurrency(selectedOrder.subtotal || selectedOrder.total_amount)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Shipping:</span>
                                        <span>{formatCurrency(selectedOrder.shipping_cost || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span>Tax:</span>
                                        <span>{formatCurrency(selectedOrder.tax_amount || 0)}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontWeight: '600',
                                        fontSize: '1rem',
                                        borderTop: '1px solid #e5e7eb',
                                        paddingTop: '0.5rem'
                                    }}>
                                        <span>Total:</span>
                                        <span>{formatCurrency(selectedOrder.total_amount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Addresses */}
                            {(selectedOrder.shipping_address || selectedOrder.billing_address) && (
                                <div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                        Addresses
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                        {selectedOrder.shipping_address && (
                                            <div>
                                                <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                                                    Shipping Address
                                                </h5>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                    {selectedOrder.shipping_address.street}<br />
                                                    {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zipCode}<br />
                                                    {selectedOrder.shipping_address.country}
                                                </div>
                                            </div>
                                        )}
                                        {selectedOrder.billing_address && (
                                            <div>
                                                <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                                                    Billing Address
                                                </h5>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                    {selectedOrder.billing_address.street}<br />
                                                    {selectedOrder.billing_address.city}, {selectedOrder.billing_address.state} {selectedOrder.billing_address.zipCode}<br />
                                                    {selectedOrder.billing_address.country}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOrdersPage;