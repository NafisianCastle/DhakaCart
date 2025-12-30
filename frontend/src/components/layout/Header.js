import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = ({ cartItemCount = 0, user = null, onSearch }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        if (onSearch && searchQuery.trim()) {
            onSearch(searchQuery.trim());
        }
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const headerStyle = {
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 50
    };

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '4rem'
    };

    const logoStyle = {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#2563eb',
        textDecoration: 'none'
    };

    const navStyle = {
        display: 'flex',
        gap: '2rem',
        alignItems: 'center'
    };

    const linkStyle = {
        color: '#374151',
        textDecoration: 'none',
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const searchStyle = {
        display: 'flex',
        flex: 1,
        maxWidth: '32rem',
        margin: '0 2rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem 1rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '0.875rem'
    };

    const buttonStyle = {
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        cursor: 'pointer'
    };

    const cartStyle = {
        position: 'relative',
        color: '#374151',
        textDecoration: 'none'
    };

    const badgeStyle = {
        position: 'absolute',
        top: '-0.5rem',
        right: '-0.5rem',
        backgroundColor: '#ef4444',
        color: 'white',
        fontSize: '0.75rem',
        borderRadius: '9999px',
        height: '1.25rem',
        width: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    return (
        <header style={headerStyle}>
            <div style={containerStyle}>
                {/* Logo */}
                <div>
                    <Link to="/" style={logoStyle}>
                        DhakaCart
                    </Link>
                </div>

                {/* Desktop Navigation */}
                <nav style={{ ...navStyle, display: window.innerWidth >= 768 ? 'flex' : 'none' }}>
                    <Link to="/" style={linkStyle}>Home</Link>
                    <Link to="/products" style={linkStyle}>Products</Link>
                    <Link to="/categories" style={linkStyle}>Categories</Link>
                    <Link to="/about" style={linkStyle}>About</Link>
                    <Link to="/contact" style={linkStyle}>Contact</Link>
                </nav>

                {/* Search Bar */}
                <div style={{ ...searchStyle, display: window.innerWidth >= 768 ? 'flex' : 'none' }}>
                    <form onSubmit={handleSearch} style={{ width: '100%' }}>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={inputStyle}
                        />
                    </form>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* User Menu */}
                    {user ? (
                        <Link to="/account" style={linkStyle}>
                            👤 {user.name}
                        </Link>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Link to="/login" style={linkStyle}>Login</Link>
                            <span style={{ color: '#d1d5db' }}>|</span>
                            <Link to="/register" style={linkStyle}>Register</Link>
                        </div>
                    )}

                    {/* Shopping Cart */}
                    <Link to="/cart" style={cartStyle}>
                        🛒
                        {cartItemCount > 0 && (
                            <span style={badgeStyle}>
                                {cartItemCount > 99 ? '99+' : cartItemCount}
                            </span>
                        )}
                    </Link>

                    {/* Mobile menu button */}
                    <button
                        onClick={toggleMenu}
                        style={{
                            ...buttonStyle,
                            display: window.innerWidth < 768 ? 'block' : 'none'
                        }}
                    >
                        {isMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
                <div style={{
                    backgroundColor: '#f9fafb',
                    padding: '1rem',
                    display: window.innerWidth < 768 ? 'block' : 'none'
                }}>
                    {/* Mobile Search */}
                    <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={inputStyle}
                        />
                    </form>

                    {/* Mobile Navigation Links */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <Link to="/" style={linkStyle} onClick={() => setIsMenuOpen(false)}>Home</Link>
                        <Link to="/products" style={linkStyle} onClick={() => setIsMenuOpen(false)}>Products</Link>
                        <Link to="/categories" style={linkStyle} onClick={() => setIsMenuOpen(false)}>Categories</Link>
                        <Link to="/about" style={linkStyle} onClick={() => setIsMenuOpen(false)}>About</Link>
                        <Link to="/contact" style={linkStyle} onClick={() => setIsMenuOpen(false)}>Contact</Link>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;