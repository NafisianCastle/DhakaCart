import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    const footerStyle = {
        backgroundColor: '#111827',
        color: 'white',
        padding: '3rem 0'
    };

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
    };

    const logoStyle = {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#60a5fa',
        marginBottom: '1rem'
    };

    const textStyle = {
        color: '#d1d5db',
        lineHeight: '1.6',
        marginBottom: '1rem'
    };

    const headingStyle = {
        fontSize: '1.125rem',
        fontWeight: '600',
        marginBottom: '1rem'
    };

    const linkStyle = {
        color: '#d1d5db',
        textDecoration: 'none',
        display: 'block',
        marginBottom: '0.5rem'
    };

    const socialStyle = {
        display: 'flex',
        gap: '1rem',
        marginTop: '1rem'
    };

    const socialLinkStyle = {
        color: '#d1d5db',
        fontSize: '1.5rem',
        textDecoration: 'none'
    };

    const bottomStyle = {
        borderTop: '1px solid #374151',
        paddingTop: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
    };

    return (
        <footer style={footerStyle}>
            <div style={containerStyle}>
                <div style={gridStyle}>
                    {/* Company Info */}
                    <div>
                        <div style={logoStyle}>DhakaCart</div>
                        <p style={textStyle}>
                            Your trusted online marketplace for quality products at great prices.
                            We bring you the best shopping experience with fast delivery and excellent customer service.
                        </p>
                        <div style={socialStyle}>
                            <a href="#" style={socialLinkStyle}>📘</a>
                            <a href="#" style={socialLinkStyle}>🐦</a>
                            <a href="#" style={socialLinkStyle}>📷</a>
                            <a href="#" style={socialLinkStyle}>💼</a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 style={headingStyle}>Quick Links</h3>
                        <Link to="/products" style={linkStyle}>All Products</Link>
                        <Link to="/categories" style={linkStyle}>Categories</Link>
                        <Link to="/deals" style={linkStyle}>Special Deals</Link>
                        <Link to="/new-arrivals" style={linkStyle}>New Arrivals</Link>
                        <Link to="/bestsellers" style={linkStyle}>Best Sellers</Link>
                    </div>

                    {/* Customer Service */}
                    <div>
                        <h3 style={headingStyle}>Customer Service</h3>
                        <Link to="/contact" style={linkStyle}>Contact Us</Link>
                        <Link to="/faq" style={linkStyle}>FAQ</Link>
                        <Link to="/shipping" style={linkStyle}>Shipping Info</Link>
                        <Link to="/returns" style={linkStyle}>Returns & Exchanges</Link>
                        <Link to="/support" style={linkStyle}>Support Center</Link>
                    </div>
                </div>

                {/* Bottom Section */}
                <div style={bottomStyle}>
                    <div style={{ color: '#d1d5db', fontSize: '0.875rem' }}>
                        © 2024 DhakaCart. All rights reserved.
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                        <Link to="/privacy" style={linkStyle}>Privacy Policy</Link>
                        <Link to="/terms" style={linkStyle}>Terms of Service</Link>
                        <Link to="/cookies" style={linkStyle}>Cookie Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;