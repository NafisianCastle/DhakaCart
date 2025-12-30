import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        minPrice: searchParams.get('minPrice') || '',
        maxPrice: searchParams.get('maxPrice') || '',
        sortBy: searchParams.get('sortBy') || 'name'
    });
    const [viewMode, setViewMode] = useState('grid');
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        loadProducts();
        loadCategories();
    }, [searchParams]);

    const loadProducts = async () => {
        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams();
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.minPrice) queryParams.append('minPrice', filters.minPrice);
            if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice);
            if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);

            logger.info('Loading products with filters', filters);
            const response = await apiClient.get(`/products?${queryParams.toString()}`);

            setProducts(response.data.data || []);

            logger.info('Products loaded successfully', {
                productCount: response.data.data?.length || 0,
                filters
            });
        } catch (err) {
            const errorMessage = 'Failed to load products';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await apiClient.get('/categories');
            setCategories(response.data.data || []);
        } catch (err) {
            logger.error('Failed to load categories', { error: err.message });
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);

        // Update URL params
        const newSearchParams = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
            if (v) newSearchParams.set(k, v);
        });
        setSearchParams(newSearchParams);
    };

    const clearFilters = () => {
        const clearedFilters = {
            search: '',
            category: '',
            minPrice: '',
            maxPrice: '',
            sortBy: 'name'
        };
        setFilters(clearedFilters);
        setSearchParams({});
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
        marginBottom: '2rem'
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

    const contentStyle = {
        display: 'grid',
        gridTemplateColumns: window.innerWidth >= 768 ? '250px 1fr' : '1fr',
        gap: '2rem'
    };

    const sidebarStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: 'fit-content'
    };

    const filterSectionStyle = {
        marginBottom: '1.5rem'
    };

    const filterTitleStyle = {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.75rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        boxSizing: 'border-box'
    };

    const selectStyle = {
        ...inputStyle,
        backgroundColor: 'white'
    };

    const buttonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        width: '100%',
        marginTop: '1rem'
    };

    const clearButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#6b7280',
        marginTop: '0.5rem'
    };

    const mainContentStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const toolbarStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
    };

    const viewToggleStyle = {
        display: 'flex',
        gap: '0.5rem'
    };

    const viewButtonStyle = (isActive) => ({
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        backgroundColor: isActive ? '#2563eb' : 'white',
        color: isActive ? 'white' : '#374151',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontSize: '0.875rem'
    });

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: viewMode === 'grid'
            ? 'repeat(auto-fill, minmax(250px, 1fr))'
            : '1fr',
        gap: '1.5rem'
    };

    const cardStyle = {
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        backgroundColor: 'white'
    };

    const listCardStyle = {
        ...cardStyle,
        display: 'flex',
        alignItems: 'center',
        padding: '1rem'
    };

    const imageStyle = {
        width: '100%',
        height: viewMode === 'grid' ? '12rem' : '6rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: viewMode === 'grid' ? '3rem' : '2rem',
        flexShrink: 0
    };

    const listImageStyle = {
        ...imageStyle,
        width: '6rem',
        marginRight: '1rem'
    };

    const contentCardStyle = {
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

    const descriptionStyle = {
        fontSize: '0.875rem',
        color: '#6b7280',
        marginBottom: '1rem'
    };

    const addToCartStyle = {
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        border: 'none',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        width: viewMode === 'grid' ? '100%' : 'auto'
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

    const noResultsStyle = {
        textAlign: 'center',
        padding: '4rem',
        color: '#6b7280'
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={loadingStyle}>Loading products...</div>
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
                        <button onClick={loadProducts} style={buttonStyle}>
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
                    <h1 style={titleStyle}>Products</h1>
                    <p style={subtitleStyle}>
                        {products.length} products found
                        {filters.search && ` for "${filters.search}"`}
                    </p>
                </div>

                <div style={contentStyle}>
                    {/* Sidebar Filters */}
                    <div style={sidebarStyle}>
                        <div style={filterSectionStyle}>
                            <h3 style={filterTitleStyle}>Search</h3>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div style={filterSectionStyle}>
                            <h3 style={filterTitleStyle}>Category</h3>
                            <select
                                value={filters.category}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                style={selectStyle}
                            >
                                <option value="">All Categories</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={filterSectionStyle}>
                            <h3 style={filterTitleStyle}>Price Range</h3>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minPrice}
                                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                                    style={inputStyle}
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxPrice}
                                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={filterSectionStyle}>
                            <h3 style={filterTitleStyle}>Sort By</h3>
                            <select
                                value={filters.sortBy}
                                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                                style={selectStyle}
                            >
                                <option value="name">Name</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="newest">Newest First</option>
                            </select>
                        </div>

                        <button onClick={loadProducts} style={buttonStyle}>
                            Apply Filters
                        </button>
                        <button onClick={clearFilters} style={clearButtonStyle}>
                            Clear Filters
                        </button>
                    </div>

                    {/* Main Content */}
                    <div style={mainContentStyle}>
                        <div style={toolbarStyle}>
                            <div>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    Showing {products.length} products
                                </span>
                            </div>
                            <div style={viewToggleStyle}>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    style={viewButtonStyle(viewMode === 'grid')}
                                >
                                    ⊞ Grid
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    style={viewButtonStyle(viewMode === 'list')}
                                >
                                    ☰ List
                                </button>
                            </div>
                        </div>

                        {products.length === 0 ? (
                            <div style={noResultsStyle}>
                                <h3>No products found</h3>
                                <p>Try adjusting your search criteria or filters.</p>
                            </div>
                        ) : (
                            <div style={gridStyle}>
                                {products.map((product) => (
                                    viewMode === 'grid' ? (
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
                                            <div style={contentCardStyle}>
                                                <h3 style={productNameStyle}>
                                                    <Link
                                                        to={`/products/${product.id}`}
                                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                                    >
                                                        {product.name}
                                                    </Link>
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ color: '#facc15' }}>⭐⭐⭐⭐⭐</span>
                                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                                        (24)
                                                    </span>
                                                </div>
                                                {product.description && (
                                                    <p style={descriptionStyle}>
                                                        {product.description.length > 100
                                                            ? product.description.substring(0, 100) + '...'
                                                            : product.description}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <p style={priceStyle}>
                                                        ${parseFloat(product.price).toFixed(2)}
                                                    </p>
                                                </div>
                                                <button style={addToCartStyle}>
                                                    Add to Cart
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={product.id} style={listCardStyle}>
                                            <div style={listImageStyle}>
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
                                            <div style={{ flex: 1 }}>
                                                <h3 style={productNameStyle}>
                                                    <Link
                                                        to={`/products/${product.id}`}
                                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                                    >
                                                        {product.name}
                                                    </Link>
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ color: '#facc15' }}>⭐⭐⭐⭐⭐</span>
                                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                                        (24)
                                                    </span>
                                                </div>
                                                {product.description && (
                                                    <p style={descriptionStyle}>
                                                        {product.description.length > 200
                                                            ? product.description.substring(0, 200) + '...'
                                                            : product.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                                <p style={priceStyle}>
                                                    ${parseFloat(product.price).toFixed(2)}
                                                </p>
                                                <button style={addToCartStyle}>
                                                    Add to Cart
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductsPage;