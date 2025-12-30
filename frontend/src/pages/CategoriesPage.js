import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError(null);

            logger.info('Loading categories');

            // Since we might not have a categories endpoint yet, let's create mock data
            // In a real implementation, this would be: const response = await apiClient.get('/categories');

            const mockCategories = [
                {
                    id: 1,
                    name: 'Electronics',
                    description: 'Latest gadgets, smartphones, laptops, and electronic accessories',
                    icon: '📱',
                    color: 'linear-gradient(to right, #60a5fa, #2563eb)',
                    productCount: 156,
                    image: null
                },
                {
                    id: 2,
                    name: 'Fashion & Clothing',
                    description: 'Trendy clothing, shoes, accessories for men, women, and kids',
                    icon: '👕',
                    color: 'linear-gradient(to right, #f472b6, #db2777)',
                    productCount: 324,
                    image: null
                },
                {
                    id: 3,
                    name: 'Home & Garden',
                    description: 'Furniture, home decor, kitchen appliances, and garden tools',
                    icon: '🏠',
                    color: 'linear-gradient(to right, #4ade80, #16a34a)',
                    productCount: 198,
                    image: null
                },
                {
                    id: 4,
                    name: 'Sports & Fitness',
                    description: 'Exercise equipment, sportswear, and outdoor gear',
                    icon: '⚽',
                    color: 'linear-gradient(to right, #fb923c, #ea580c)',
                    productCount: 87,
                    image: null
                },
                {
                    id: 5,
                    name: 'Books & Media',
                    description: 'Books, e-books, audiobooks, movies, and educational content',
                    icon: '📚',
                    color: 'linear-gradient(to right, #c084fc, #9333ea)',
                    productCount: 445,
                    image: null
                },
                {
                    id: 6,
                    name: 'Beauty & Health',
                    description: 'Skincare, makeup, health supplements, and wellness products',
                    icon: '💄',
                    color: 'linear-gradient(to right, #f87171, #dc2626)',
                    productCount: 123,
                    image: null
                },
                {
                    id: 7,
                    name: 'Toys & Games',
                    description: 'Educational toys, board games, video games, and collectibles',
                    icon: '🎮',
                    color: 'linear-gradient(to right, #fbbf24, #f59e0b)',
                    productCount: 76,
                    image: null
                },
                {
                    id: 8,
                    name: 'Automotive',
                    description: 'Car accessories, tools, parts, and maintenance products',
                    icon: '🚗',
                    color: 'linear-gradient(to right, #6b7280, #374151)',
                    productCount: 54,
                    image: null
                }
            ];

            setCategories(mockCategories);

            logger.info('Categories loaded successfully', {
                categoryCount: mockCategories.length
            });
        } catch (err) {
            const errorMessage = 'Failed to load categories';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
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
        textAlign: 'center',
        marginBottom: '3rem'
    };

    const titleStyle = {
        fontSize: '2.5rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '1rem'
    };

    const subtitleStyle = {
        fontSize: '1.125rem',
        color: '#6b7280',
        maxWidth: '42rem',
        margin: '0 auto'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        textDecoration: 'none',
        color: 'inherit'
    };

    const imageStyle = (color) => ({
        height: '10rem',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '3rem',
        position: 'relative'
    });

    const contentStyle = {
        padding: '1.5rem'
    };

    const categoryNameStyle = {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.75rem'
    };

    const descriptionStyle = {
        fontSize: '0.875rem',
        color: '#6b7280',
        lineHeight: '1.5',
        marginBottom: '1rem'
    };

    const footerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const productCountStyle = {
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    const arrowStyle = {
        color: '#2563eb',
        fontWeight: '600',
        fontSize: '0.875rem'
    };

    const loadingStyle = {
        textAlign: 'center',
        padding: '4rem',
        fontSize: '1.125rem',
        color: '#6b7280'
    };

    const errorStyle = {
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        color: '#dc2626'
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
        marginTop: '1rem'
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={loadingStyle}>Loading categories...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={errorStyle}>
                        <p>{error}</p>
                        <button onClick={loadCategories} style={buttonStyle}>
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
                    <h1 style={titleStyle}>Shop by Category</h1>
                    <p style={subtitleStyle}>
                        Explore our wide range of product categories and find exactly what you're looking for.
                        From electronics to fashion, we have everything you need.
                    </p>
                </div>

                <div style={gridStyle}>
                    {categories.map((category) => (
                        <Link
                            key={category.id}
                            to={`/products?category=${category.id}`}
                            style={cardStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                            }}
                        >
                            <div style={imageStyle(category.color)}>
                                {category.image ? (
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <span>{category.icon}</span>
                                )}
                            </div>

                            <div style={contentStyle}>
                                <h2 style={categoryNameStyle}>{category.name}</h2>
                                <p style={descriptionStyle}>{category.description}</p>

                                <div style={footerStyle}>
                                    <span style={productCountStyle}>
                                        {category.productCount} products
                                    </span>
                                    <span style={arrowStyle}>
                                        Explore →
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Featured Categories Section */}
                <div style={{ marginTop: '4rem' }}>
                    <div style={headerStyle}>
                        <h2 style={{ ...titleStyle, fontSize: '2rem' }}>Popular This Week</h2>
                        <p style={subtitleStyle}>
                            Check out the most popular categories this week
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem'
                    }}>
                        {categories.slice(0, 4).map((category) => (
                            <Link
                                key={`popular-${category.id}`}
                                to={`/products?category=${category.id}`}
                                style={{
                                    ...cardStyle,
                                    backgroundColor: 'white',
                                    padding: '1.5rem',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}
                            >
                                <div style={{
                                    width: '4rem',
                                    height: '4rem',
                                    background: category.color,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem'
                                }}>
                                    {category.icon}
                                </div>
                                <div>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        color: '#111827',
                                        marginBottom: '0.25rem'
                                    }}>
                                        {category.name}
                                    </h3>
                                    <p style={{
                                        fontSize: '0.875rem',
                                        color: '#6b7280',
                                        margin: 0
                                    }}>
                                        {category.productCount} items
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;