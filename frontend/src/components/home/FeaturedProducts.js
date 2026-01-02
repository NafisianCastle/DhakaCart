import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api';
import logger from '../../logger';

const FeaturedProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadFeaturedProducts();
    }, []);

    const loadFeaturedProducts = async () => {
        try {
            setLoading(true);
            setError(null);

            logger.info('Loading featured products');
            const response = await apiClient.get('/products?limit=8');

            setProducts(response.data.data || []);

            logger.info('Featured products loaded successfully', {
                productCount: response.data.data?.length || 0
            });
        } catch (err) {
            const errorMessage = 'Failed to load featured products';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const sectionStyle = {
        padding: '3rem 0',
        backgroundColor: '#f9fafb'
    };

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
    };

    const headerStyle = {
        textAlign: 'center',
        marginBottom: '3rem'
    };

    const titleStyle = {
        fontSize: '2.25rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '1rem'
    };

    const subtitleStyle = {
        fontSize: '1.125rem',
        color: '#4b5563'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s'
    };

    const imageStyle = {
        width: '100%',
        height: '16rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '3rem'
    };

    const contentStyle = {
        padding: '1rem'
    };

    const productNameStyle = {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const priceStyle = {
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const buttonStyle = {
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        border: 'none',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%'
    };

    const loadingStyle = {
        textAlign: 'center',
        padding: '2rem',
        fontSize: '1.125rem',
        color: '#4b5563'
    };

    const errorStyle = {
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        color: '#dc2626'
    };

    const viewAllStyle = {
        textAlign: 'center'
    };

    const viewAllButtonStyle = {
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        display: 'inline-block'
    };

    if (loading) {
        return (
            <section style={sectionStyle}>
                <div style={containerStyle}>
                    <div style={headerStyle}>
                        <h2 style={titleStyle}>Featured Products</h2>
                        <div style={loadingStyle}>Loading our best products...</div>
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section style={sectionStyle}>
                <div style={containerStyle}>
                    <div style={headerStyle}>
                        <h2 style={titleStyle}>Featured Products</h2>
                        <div style={errorStyle}>
                            <p>{error}</p>
                            <button onClick={loadFeaturedProducts} style={buttonStyle}>
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section style={sectionStyle}>
            <div style={containerStyle}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>Featured Products</h2>
                    <p style={subtitleStyle}>
                        Discover our most popular and highly-rated products
                    </p>
                </div>

                <div style={gridStyle}>
                    {products.map((product) => (
                        <div key={product.id} style={cardStyle}>
                            <div style={imageStyle}>
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span>📦</span>
                                )}
                            </div>
                            <div style={contentStyle}>
                                <h3 style={productNameStyle}>
                                    <Link to={`/products/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        {product.name}
                                    </Link>
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#facc15' }}>⭐⭐⭐⭐⭐</span>
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>(24)</span>
                                </div>
                                {product.description && (
                                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                                        {product.description.length > 100
                                            ? product.description.substring(0, 100) + '...'
                                            : product.description}
                                    </p>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={priceStyle}>
                                        ${parseFloat(product.price).toFixed(2)}
                                    </p>
                                    <button style={buttonStyle}>
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {products.length > 0 && (
                    <div style={viewAllStyle}>
                        <Link to="/products" style={viewAllButtonStyle}>
                            View All Products
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
};

export default FeaturedProducts;