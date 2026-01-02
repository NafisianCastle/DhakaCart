import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AdminProductFormPage = () => {
    const { id } = useParams();
    const isEditing = Boolean(id);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        stockQuantity: '',
        categoryId: '',
        imageUrl: '',
        isActive: true
    });
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        checkAdminAuth();
        fetchCategories();
        if (isEditing) {
            fetchProduct();
        }
    }, [id]);

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

    const fetchProduct = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await apiClient.get(`/products/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const product = response.data.product;
            setFormData({
                name: product.name || '',
                description: product.description || '',
                price: product.price || '',
                stockQuantity: product.stock_quantity || '',
                categoryId: product.category_id || '',
                imageUrl: product.image_url || '',
                isActive: product.is_active !== false
            });
        } catch (err) {
            setError('Failed to load product');
            logger.error('Product fetch failed', { error: err.message, productId: id });
        }
    };
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('adminToken');
            const productData = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                stockQuantity: parseInt(formData.stockQuantity),
                categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
                imageUrl: formData.imageUrl,
                isActive: formData.isActive
            };

            if (isEditing) {
                await apiClient.put(`/products/${id}`, productData, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setSuccess('Product updated successfully!');
                logger.info('Product updated successfully', { productId: id });
            } else {
                await apiClient.post('/products', productData, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setSuccess('Product created successfully!');
                logger.info('Product created successfully');

                // Reset form for new product
                setFormData({
                    name: '',
                    description: '',
                    price: '',
                    stockQuantity: '',
                    categoryId: '',
                    imageUrl: '',
                    isActive: true
                });
            }

            // Redirect after a short delay
            setTimeout(() => {
                navigate('/admin/products');
            }, 2000);

        } catch (err) {
            const errorMessage = err.message || `Failed to ${isEditing ? 'update' : 'create'} product`;
            setError(errorMessage);
            logger.error(`Product ${isEditing ? 'update' : 'creation'} failed`, {
                error: err.message,
                productId: id
            });
        } finally {
            setLoading(false);
        }
    };

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

    const backButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: '500'
    };

    const cardStyle = {
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        maxWidth: '600px',
        margin: '0 auto'
    };

    const formStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
    };

    const labelStyle = {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.25rem',
        display: 'block'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        boxSizing: 'border-box'
    };

    const textareaStyle = {
        ...inputStyle,
        minHeight: '100px',
        resize: 'vertical'
    };

    const buttonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: loading ? '#9ca3af' : '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        alignSelf: 'flex-start'
    };

    const errorStyle = {
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem'
    };

    const successStyle = {
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        color: '#166534',
        padding: '0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem'
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <h1 style={titleStyle}>
                    {isEditing ? 'Edit Product' : 'Add New Product'}
                </h1>
                <button
                    onClick={() => navigate('/admin/products')}
                    style={backButtonStyle}
                >
                    ← Back to Products
                </button>
            </div>

            {/* Form */}
            <div style={cardStyle}>
                {error && (
                    <div style={errorStyle}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={successStyle}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={formStyle}>
                    <div>
                        <label htmlFor="name" style={labelStyle}>
                            Product Name *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            style={inputStyle}
                            placeholder="Enter product name"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" style={labelStyle}>
                            Description
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            style={textareaStyle}
                            placeholder="Enter product description"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label htmlFor="price" style={labelStyle}>
                                Price ($) *
                            </label>
                            <input
                                type="number"
                                id="price"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                required
                                min="0"
                                step="0.01"
                                style={inputStyle}
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label htmlFor="stockQuantity" style={labelStyle}>
                                Stock Quantity *
                            </label>
                            <input
                                type="number"
                                id="stockQuantity"
                                name="stockQuantity"
                                value={formData.stockQuantity}
                                onChange={handleChange}
                                required
                                min="0"
                                style={inputStyle}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="categoryId" style={labelStyle}>
                            Category
                        </label>
                        <select
                            id="categoryId"
                            name="categoryId"
                            value={formData.categoryId}
                            onChange={handleChange}
                            style={inputStyle}
                        >
                            <option value="">Select a category</option>
                            {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="imageUrl" style={labelStyle}>
                            Image URL
                        </label>
                        <input
                            type="url"
                            id="imageUrl"
                            name="imageUrl"
                            value={formData.imageUrl}
                            onChange={handleChange}
                            style={inputStyle}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive}
                                onChange={handleChange}
                            />
                            <span style={labelStyle}>Product is active</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={buttonStyle}
                    >
                        {loading ?
                            (isEditing ? 'Updating...' : 'Creating...') :
                            (isEditing ? 'Update Product' : 'Create Product')
                        }
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminProductFormPage;