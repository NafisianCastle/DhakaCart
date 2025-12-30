import React from 'react';
import { Link } from 'react-router-dom';

const HeroSection = () => {
    const heroStyle = {
        background: 'linear-gradient(to right, #2563eb, #7c3aed)',
        color: 'white',
        padding: '4rem 0',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center'
    };

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem',
        display: 'grid',
        gridTemplateColumns: window.innerWidth >= 1024 ? '1fr 1fr' : '1fr',
        gap: '3rem',
        alignItems: 'center'
    };

    const contentStyle = {
        textAlign: window.innerWidth >= 1024 ? 'left' : 'center'
    };

    const titleStyle = {
        fontSize: window.innerWidth >= 768 ? '3.75rem' : '2.25rem',
        fontWeight: '800',
        lineHeight: '1.1',
        marginBottom: '1.5rem'
    };

    const subtitleStyle = {
        fontSize: '1.125rem',
        lineHeight: '1.7',
        marginBottom: '2rem',
        color: '#e5e7eb'
    };

    const buttonContainerStyle = {
        display: 'flex',
        gap: '1rem',
        justifyContent: window.innerWidth >= 1024 ? 'flex-start' : 'center',
        flexWrap: 'wrap'
    };

    const primaryButtonStyle = {
        backgroundColor: 'white',
        color: '#1d4ed8',
        padding: '1rem 2rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '1rem',
        display: 'inline-block',
        transition: 'all 0.2s'
    };

    const secondaryButtonStyle = {
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '1rem 2rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '1rem',
        display: 'inline-block',
        border: '1px solid transparent',
        transition: 'all 0.2s'
    };

    const imageStyle = {
        height: '24rem',
        background: 'linear-gradient(to bottom right, #c084fc, #3b82f6)',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
    };

    return (
        <div style={heroStyle}>
            <div style={containerStyle}>
                <div style={contentStyle}>
                    <h1 style={titleStyle}>
                        Welcome to <span style={{ color: '#fcd34d' }}>DhakaCart</span>
                    </h1>
                    <p style={subtitleStyle}>
                        Discover amazing products at unbeatable prices. From electronics to fashion,
                        home essentials to gifts - we have everything you need, delivered right to your doorstep.
                    </p>
                    <div style={buttonContainerStyle}>
                        <Link to="/products" style={primaryButtonStyle}>
                            Shop Now
                        </Link>
                        <Link to="/categories" style={secondaryButtonStyle}>
                            Browse Categories
                        </Link>
                    </div>
                </div>

                <div style={imageStyle}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
                    <p style={{ fontSize: '1.25rem', fontWeight: '600' }}>Your Shopping Destination</p>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;