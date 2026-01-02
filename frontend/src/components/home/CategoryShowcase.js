import React from 'react';
import { Link } from 'react-router-dom';

const CategoryShowcase = () => {
    const categories = [
        {
            id: 1,
            name: 'Electronics',
            description: 'Latest gadgets and tech',
            icon: '📱',
            color: 'linear-gradient(to right, #60a5fa, #2563eb)',
            itemCount: '500+ items'
        },
        {
            id: 2,
            name: 'Fashion',
            description: 'Trendy clothing and accessories',
            icon: '👕',
            color: 'linear-gradient(to right, #f472b6, #db2777)',
            itemCount: '1200+ items'
        },
        {
            id: 3,
            name: 'Home & Garden',
            description: 'Everything for your home',
            icon: '🏠',
            color: 'linear-gradient(to right, #4ade80, #16a34a)',
            itemCount: '800+ items'
        },
        {
            id: 4,
            name: 'Sports & Fitness',
            description: 'Gear for active lifestyle',
            icon: '⚽',
            color: 'linear-gradient(to right, #fb923c, #ea580c)',
            itemCount: '300+ items'
        },
        {
            id: 5,
            name: 'Books & Media',
            description: 'Knowledge and entertainment',
            icon: '📚',
            color: 'linear-gradient(to right, #c084fc, #9333ea)',
            itemCount: '2000+ items'
        },
        {
            id: 6,
            name: 'Beauty & Health',
            description: 'Care for your wellbeing',
            icon: '💄',
            color: 'linear-gradient(to right, #f87171, #dc2626)',
            itemCount: '400+ items'
        }
    ];

    const sectionStyle = {
        padding: '4rem 0',
        backgroundColor: 'white'
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.2s, box-shadow 0.2s'
    };

    const iconSectionStyle = (color) => ({
        height: '8rem',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem'
    });

    const contentStyle = {
        padding: '1.5rem'
    };

    const categoryNameStyle = {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const descriptionStyle = {
        fontSize: '0.875rem',
        color: '#4b5563',
        marginBottom: '0.75rem'
    };

    const footerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const itemCountStyle = {
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    const arrowStyle = {
        color: '#2563eb',
        fontWeight: '600',
        fontSize: '0.875rem'
    };

    const viewAllStyle = {
        textAlign: 'center'
    };

    const viewAllButtonStyle = {
        backgroundColor: 'white',
        color: '#374151',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        fontSize: '1rem',
        fontWeight: '600',
        border: '1px solid #d1d5db',
        display: 'inline-block'
    };

    return (
        <section style={sectionStyle}>
            <div style={containerStyle}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>Shop by Category</h2>
                    <p style={subtitleStyle}>
                        Explore our wide range of product categories
                    </p>
                </div>

                <div style={gridStyle}>
                    {categories.map((category) => (
                        <Link
                            key={category.id}
                            to={`/categories/${category.id}`}
                            style={cardStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px rgba(0, 0, 0, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                            }}
                        >
                            <div style={iconSectionStyle(category.color)}>
                                <span>{category.icon}</span>
                            </div>
                            <div style={contentStyle}>
                                <h3 style={categoryNameStyle}>
                                    {category.name}
                                </h3>
                                <p style={descriptionStyle}>
                                    {category.description}
                                </p>
                                <div style={footerStyle}>
                                    <span style={itemCountStyle}>{category.itemCount}</span>
                                    <span style={arrowStyle}>Explore →</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                <div style={viewAllStyle}>
                    <Link to="/categories" style={viewAllButtonStyle}>
                        View All Categories
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default CategoryShowcase;