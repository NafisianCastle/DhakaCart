import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const WishlistPage = ({ updateCartCount }) => {
    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadWishlist();
    }, []);

    const loadWishlist = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }

            setLoading(true);
            setError(null);

            // Load wishlist from localStorage (in a real app, this would be from the backend)
            const wishlistData = localStorage.getItem('wishlist');
            if (wishlistData) {
                const wishlist = JSON.parse(wishlistData);
                setWishlistItems(wishlist);
                logger.info('Wishlist loaded', { itemCount: wishlist.length });
            }

        } catch (err) {
            const errorMessage = 'Failed to load wishlist';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const removeFromWishlist = (productId) => {
        const updatedWishlist = wishlistItems.filter(item => item.id !== productId);
        setWishlistItems(updatedWishlist);
        localStorage.setItem('wishlist', JSON.stringify(updatedWishlist));
        logger.info('Item removed from wishlist', { productId });
    };

    const addToCart = (item) => {
        try {
            // Get current cart from localStorage
            const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

            // Check if product already exists in cart
            const existingItemIndex = currentCart.findIndex(cartItem => cartItem.productId === item.id);

            if (existingItemIndex >= 0) {
                // Update quantity
                currentCart[existingItemIndex].quantity += 1;
            } else {
                // Add new item
                currentCart.push({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                    image: item.image_url
                });
            }

            // Save to localStorage
            localStorage.setItem('cart', JSON.stringify(currentCart));

            // Update cart count in header
            if (updateCartCount) {
                const newCount = currentCart.reduce((total, cartItem) => total + cartItem.quantity, 0);
                updateCartCount(newCount);
            }

            logger.info('Product added to cart from wishlist', { productId: item.id });
            alert(`${item.name} added to cart!`);

        } catch (err) {
            logger.error('Failed to add product to cart', { error: err.message });
            alert('Failed to add product to cart. Please try again.');
        }
    };

    const moveToCart = (item) => {
        addToCart(item);
        removeFromWishlist(item.id);
    };

    const clearWishlist = () => {
        if (window.confirm('Are you sure you want to clear your entire wishlist?')) {
            setWishlistItems([]);
            localStorage.removeItem('wishlist');
            logger.info('Wishlist cleared');
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

    const actionsStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
    };

    const itemCountStyle = {
        fontSize: '1rem',
        color: '#6b7280'
    };

    const clearButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.5rem'
    };

    const itemCardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        position: 'relative'
    };

    const removeButtonStyle = {
        position: 'absolute',
        top: '0.75rem',
        right: '0.75rem',
        width: '2rem',
        height: '2rem',
        borderRadius: '50%',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const imageStyle = {
        width: '100%',
        height: '200px',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '3rem',
        marginBottom: '1rem'
    };

    const itemNameStyle = {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const itemPriceStyle = {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#2563eb',
        marginBottom: '1rem'
    };

    const buttonGroupStyle = {
        display: 'flex',
        gap: '0.5rem'
    };

    const primaryButtonStyle = {
        flex: 1,
        padding: '0.75rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const secondaryButtonStyle = {
        flex: 1,
        padding: '0.75rem',
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'none',
        textAlign: 'center'
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

    const actionButtonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-block'
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Loading wishlist...</h2>
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
                        <button onClick={loadWishlist} style={actionButtonStyle}>
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
                    <h1 style={titleStyle}>My Wishlist</h1>
                    <p style={subtitleStyle}>
                        Save items for later and never lose track of what you want
                    </p>
                </div>

                {wishlistItems.length === 0 ? (
                    <div style={emptyStateStyle}>
                        <div style={emptyIconStyle}>❤️</div>
                        <h2 style={emptyTitleStyle}>Your wishlist is empty</h2>
                        <p style={emptyDescStyle}>
                            Start adding items to your wishlist by clicking the heart icon on products you love.
                        </p>
                        <Link to="/products" style={actionButtonStyle}>
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div>
                        <div style={actionsStyle}>
                            <div style={itemCountStyle}>
                                {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''} in your wishlist
                            </div>
                            <button onClick={clearWishlist} style={clearButtonStyle}>
                                Clear Wishlist
                            </button>
                        </div>

                        <div style={gridStyle}>
                            {wishlistItems.map((item) => (
                                <div key={item.id} style={itemCardStyle}>
                                    <button
                                        onClick={() => removeFromWishlist(item.id)}
                                        style={removeButtonStyle}
                                        title="Remove from wishlist"
                                    >
                                        ✕
                                    </button>

                                    <div style={imageStyle}>
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.375rem' }}
                                            />
                                        ) : (
                                            <span>📦</span>
                                        )}
                                    </div>

                                    <h3 style={itemNameStyle}>
                                        <Link
                                            to={`/products/${item.id}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            {item.name}
                                        </Link>
                                    </h3>

                                    <div style={itemPriceStyle}>
                                        ${parseFloat(item.price).toFixed(2)}
                                    </div>

                                    <div style={buttonGroupStyle}>
                                        <button
                                            onClick={() => moveToCart(item)}
                                            style={primaryButtonStyle}
                                        >
                                            Move to Cart
                                        </button>
                                        <Link
                                            to={`/products/${item.id}`}
                                            style={secondaryButtonStyle}
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

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

export default WishlistPage;