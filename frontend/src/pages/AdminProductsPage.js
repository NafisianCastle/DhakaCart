import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        page: 1,
        limit: 20
    });
    const [pagination, setPagination] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        checkAdminAuth();
        fetchCategories();
        fetchProducts();
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [filters]);

    const checkAdminAuth = () => {
        const token = localStorage.getItem('adminToken');
        const user = localStorage.getItem('adminUser');

        if (!token || !user) {
            navigate('/admin/login');
            return;
        }

        try {
            const userData = JSON.parse(user);
            if (userData.role !== 'admin') {
                navigate('/admin/login');
            }
        } catch (err) {
            navigate('/admin/login');
        }
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const queryParams = new URLSearchParams();

            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });

            const response = await apiClient.get(`/products?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setProducts(response.data.products);
            setPagination(response.data.pagination);
            setLoading(false);
        } catch (err) {
            setError('Failed to load products');
            setLoading(false);
            logger.error('Products fetch failed', { error: err.message });
        }
    };

    const fetchCategories = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await apiClient.get('/products/categories', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setCategories(response.data.categories);
        } catch (err) {
            logger.error('Categories fetch failed', { error: err.message });
        }
    };
    const handleDeleteProduct = async (productId) => {
        try {
            const token = localStorage.getItem('adminToken');
            await apiClient.delete(`/products/${productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setProducts(products.filter(p => p.id !== productId));
            setShowDeleteModal(false);
            setProductToDelete(null);
            logger.info('Product deleted successfully', { productId });
        } catch (err) {
            setError('Failed to delete product');
            logger.error('Product deletion failed', { error: err.message, productId });
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: 1 // Reset to first page when filtering
        }));
    };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({
            ...prev,
            page: newPage
        }));
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    <p>Loading products...</p>
                </div>
            </div>
        );
    }

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '1rem'
    };

    const headerStyle = {
        backgroundColor: 'white',
        padding: '1rem 2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const titleStyle = {
        fontSize: '1.875rem',
        fontWeight: '700',
        color: '#111827',
        margin: 0
    };

    const buttonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const backButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#6b7280',
        marginRight: '1rem'
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
    };

    const filtersStyle = {
        padding: '1.5rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        alignItems: 'end'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        boxSizing: 'border-box'
    };

    const tableStyle = {
        width: '100%',
        borderCollapse: 'collapse'
    };

    const thStyle = {
        padding: '0.75rem 1rem',
        textAlign: 'left',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
    };

    const tdStyle = {
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        fontSize: '0.875rem'
    };

    const actionButtonStyle = {
        padding: '0.25rem 0.5rem',
        border: 'none',
        borderRadius: '0.25rem',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '500',
        marginRight: '0.5rem'
    };

    const editButtonStyle = {
        ...actionButtonStyle,
        backgroundColor: '#3b82f6',
        color: 'white'
    };

    const deleteButtonStyle = {
        ...actionButtonStyle,
        backgroundColor: '#dc2626',
        color: 'white'
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h1 style={titleStyle}>Product Management</h1>
                <div>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        style={backButtonStyle}
                    >
                        ← Back to Dashboard
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/new')}
                        style={buttonStyle}
                    >
                        + Add New Product
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem'
                }}>
                    {error}
                </div>
            )}
            {/* Products Table */}
            <div style={cardStyle}>
                {/* Filters */}
                <div style={filtersStyle}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Search Products
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name or description..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Category
                        </label>
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="">All Categories</option>
                            {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                            Items per page
                        </label>
                        <select
                            value={filters.limit}
                            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                            style={inputStyle}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Image</th>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Price</th>
                                <th style={thStyle}>Stock</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.length > 0 ? products.map(product => (
                                <tr key={product.id}>
                                    <td style={tdStyle}>
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    objectFit: 'cover',
                                                    borderRadius: '0.25rem'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                backgroundColor: '#f3f4f6',
                                                borderRadius: '0.25rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                color: '#6b7280'
                                            }}>
                                                No Image
                                            </div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{product.name}</div>
                                            {product.description && (
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: '#6b7280',
                                                    maxWidth: '200px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {product.description}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        {product.category_name || 'Uncategorized'}
                                    </td>
                                    <td style={tdStyle}>
                                        {formatCurrency(product.price)}
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            color: product.stock_quantity > 10 ? '#10b981' :
                                                product.stock_quantity > 0 ? '#f59e0b' : '#dc2626'
                                        }}>
                                            {product.stock_quantity}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            backgroundColor: product.is_active ? '#d1fae5' : '#fee2e2',
                                            color: product.is_active ? '#065f46' : '#991b1b'
                                        }}>
                                            {product.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                                            style={editButtonStyle}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                setProductToDelete(product);
                                                setShowDeleteModal(true);
                                            }}
                                            style={deleteButtonStyle}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '2rem' }}>
                                        No products found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div style={{
                        padding: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                            {pagination.total} products
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    backgroundColor: pagination.hasPrev ? 'white' : '#f9fafb',
                                    color: pagination.hasPrev ? '#374151' : '#9ca3af',
                                    cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Previous
                            </button>
                            <span style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                color: '#374151'
                            }}>
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={!pagination.hasNext}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    backgroundColor: pagination.hasNext ? 'white' : '#f9fafb',
                                    color: pagination.hasNext ? '#374151' : '#9ca3af',
                                    cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            {showDeleteModal && productToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '0.5rem',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                            Delete Product
                        </h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                            Are you sure you want to delete "{productToDelete.name}"? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setProductToDelete(null);
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteProduct(productToDelete.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '500'
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProductsPage;