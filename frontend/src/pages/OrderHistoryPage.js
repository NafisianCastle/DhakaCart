import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const OrderHistoryPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }

            setLoading(true);
            setError(null);

            // In a real app, this would fetch from the backend
            // const response = await apiClient.get('/orders');
            // setOrders(response.data.data || []);

            // For now, simulate with localStorage data
            const mockOrders = [
                {
                    id: 'ORD-1234567890',
                    date: '2024-12-30',
                    status: 'delivered',
                    total: 89.97,
                    items: [
                        { name: 'Wireless Headphones', quantity: 1, price: 59.99 },
                        { name: 'Phone Case', quantity: 2, price: 14.99 }
                    ],
                    shippingAddress: {
                        firstName: 'John',
                        lastName: 'Doe',
                        address: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zipCode: '10001'
                    }
                },
                {
                    id: 'ORD-1234567891',
                    date: '2024-12-28',
                    status: 'shipped',
                    total: 149.99,
                    items: [
                        { name: 'Laptop Stand', quantity: 1, price: 149.99 }
                    ],
                    trackingNumber: 'TRK123456789',
                    shippingAddress: {
                        firstName: 'John',
                        lastName: 'Doe',
                        address: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zipCode: '10001'
                    }
                },
                {
                    id: 'ORD-1234567892',
                    date: '2024-12-25',
                    status: 'processing',
                    total: 299.99,
                    items: [
                        { name: 'Gaming Mouse', quantity: 1, price: 79.99 },
                        { name: 'Mechanical Keyboard', quantity: 1, price: 220.00 }
                    ],
                    shippingAddress: {
                        firstName: 'John',
                        lastName: 'Doe',
                        address: '123 Main St',
                        city: 'New York',
                        state: 'NY',
                        zipCode: '10001'
                    }
                }
            ];

            setOrders(mockOrders);
            logger.info('Orders loaded successfully', { orderCount: mockOrders.length });

        } catch (err) {
            const errorMessage = 'Failed to load orders';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'delivered':
                return '#059669';
            case 'shipped':
                return '#2563eb';
            case 'processing':
                return '#d97706';
            case 'cancelled':
                return '#dc2626';
            default:
                return '#6b7280';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'delivered':
                return 'Delivered';
            case 'shipped':
                return 'Shipped';
            case 'processing':
                return 'Processing';
            case 'cancelled':
                return 'Cancelled';
            default:
                return 'Unknown';
        }
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

    const orderCardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const orderHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb'
    };

    const orderInfoStyle = {
        flex: 1
    };

    const orderIdStyle = {
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.25rem'
    };

    const orderDateStyle = {
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    const statusBadgeStyle = (status) => ({
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: getStatusColor(status) + '20',
        color: getStatusColor(status),
        textTransform: 'uppercase'
    });

    const orderItemsStyle = {
        marginBottom: '1rem'
    };

    const itemStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0',
        fontSize: '0.875rem'
    };

    const itemNameStyle = {
        fontWeight: '500',
        color: '#111827'
    };

    const itemDetailsStyle = {
        color: '#6b7280'
    };

    const orderFooterStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb'
    };

    const totalStyle = {
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827'
    };

    const actionButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-block'
    };

    const secondaryButtonStyle = {
        ...actionButtonStyle,
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        marginRight: '0.5rem'
    };

    const emptyStateStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '4rem 2rem',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const emptyIconStyle = {
        fontSize: '4rem',
        marginBottom: '1rem'
    };

    const emptyTitleStyle = {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const emptyDescStyle = {
        color: '#6b7280',
        marginBottom: '2rem'
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Loading orders...</h2>
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
                        <button onClick={loadOrders} style={actionButtonStyle}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={innerContainerStyle}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>Order History</h1>
                    <p style={subtitleStyle}>
                        Track your orders and view purchase history
                    </p>
                </div>

                {orders.length === 0 ? (
                    <div style={emptyStateStyle}>
                        <div style={emptyIconStyle}>📦</div>
                        <h2 style={emptyTitleStyle}>No orders yet</h2>
                        <p style={emptyDescStyle}>
                            You haven't placed any orders yet. Start shopping to see your order history here.
                        </p>
                        <Link to="/products" style={actionButtonStyle}>
                            Start Shopping
                        </Link>
                    </div>
                ) : (
                    <div>
                        {orders.map((order) => (
                            <div key={order.id} style={orderCardStyle}>
                                <div style={orderHeaderStyle}>
                                    <div style={orderInfoStyle}>
                                        <div style={orderIdStyle}>Order #{order.id}</div>
                                        <div style={orderDateStyle}>
                                            Placed on {new Date(order.date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                    <div style={statusBadgeStyle(order.status)}>
                                        {getStatusText(order.status)}
                                    </div>
                                </div>

                                <div style={orderItemsStyle}>
                                    {order.items.map((item, index) => (
                                        <div key={index} style={itemStyle}>
                                            <div>
                                                <div style={itemNameStyle}>{item.name}</div>
                                                <div style={itemDetailsStyle}>
                                                    Qty: {item.quantity} × ${item.price.toFixed(2)}
                                                </div>
                                            </div>
                                            <div style={itemNameStyle}>
                                                ${(item.quantity * item.price).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {order.trackingNumber && (
                                    <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: '500' }}>Tracking Number: </span>
                                        <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>
                                            {order.trackingNumber}
                                        </span>
                                    </div>
                                )}

                                <div style={orderFooterStyle}>
                                    <div style={totalStyle}>
                                        Total: ${order.total.toFixed(2)}
                                    </div>
                                    <div>
                                        <Link to={`/orders/${order.id}`} style={secondaryButtonStyle}>
                                            View Details
                                        </Link>
                                        {order.status === 'delivered' && (
                                            <button style={actionButtonStyle}>
                                                Reorder
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <Link to="/account" style={secondaryButtonStyle}>
                                ← Back to Account
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderHistoryPage;