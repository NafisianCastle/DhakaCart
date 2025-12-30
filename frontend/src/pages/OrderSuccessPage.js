import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logger from '../logger';

const OrderSuccessPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { orderId, total } = location.state || {};

    useEffect(() => {
        // If no order data, redirect to home
        if (!orderId || !total) {
            navigate('/');
            return;
        }

        logger.info('Order success page viewed', { orderId, total });
    }, [orderId, total, navigate]);

    if (!orderId || !total) {
        return null; // Will redirect
    }

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '3rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
    };

    const iconStyle = {
        fontSize: '4rem',
        color: '#059669',
        marginBottom: '1.5rem'
    };

    const titleStyle = {
        fontSize: '2rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '1rem'
    };

    const subtitleStyle = {
        fontSize: '1.125rem',
        color: '#6b7280',
        marginBottom: '2rem'
    };

    const orderInfoStyle = {
        backgroundColor: '#f9fafb',
        borderRadius: '0.375rem',
        padding: '1.5rem',
        marginBottom: '2rem'
    };

    const orderRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.5rem',
        fontSize: '0.875rem'
    };

    const totalRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb',
        fontSize: '1.125rem',
        fontWeight: '700'
    };

    const buttonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-block',
        marginRight: '1rem'
    };

    const secondaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db'
    };

    const infoListStyle = {
        textAlign: 'left',
        marginTop: '2rem',
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={iconStyle}>✅</div>

                <h1 style={titleStyle}>Order Confirmed!</h1>

                <p style={subtitleStyle}>
                    Thank you for your purchase. Your order has been successfully placed.
                </p>

                <div style={orderInfoStyle}>
                    <div style={orderRowStyle}>
                        <span>Order Number:</span>
                        <span style={{ fontWeight: '600' }}>{orderId}</span>
                    </div>

                    <div style={totalRowStyle}>
                        <span>Total Amount:</span>
                        <span>${parseFloat(total).toFixed(2)}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <Link to="/products" style={buttonStyle}>
                        Continue Shopping
                    </Link>

                    <Link to="/account" style={secondaryButtonStyle}>
                        View Orders
                    </Link>
                </div>

                <div style={infoListStyle}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                        What's Next?
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        <li style={{ marginBottom: '0.5rem' }}>
                            📧 You'll receive an order confirmation email shortly
                        </li>
                        <li style={{ marginBottom: '0.5rem' }}>
                            📦 We'll send you tracking information when your order ships
                        </li>
                        <li style={{ marginBottom: '0.5rem' }}>
                            🚚 Estimated delivery: 3-5 business days
                        </li>
                        <li>
                            💬 Questions? Contact our support team
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default OrderSuccessPage;