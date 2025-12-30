import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const ProductDetailPage = ({ updateCartCount }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [addingToWishlist, setAddingToWishlist] = useState(false);

    useEffect(() => {
        if (id) {
            loadProduct();
            loadRelatedProducts();
            checkWishlistStatus();
        }
    }, [id]);

    const loadProduct = async () => {
        try {
            setLoading(true);
            setError(null);

            logger.info('Loading product details', { productId: id });
            const response = await apiClient.get(`/products/${id}`);

            setProduct(response.data.data);

            logger.info('Product details loaded successfully', {
                productId: id,
                productName: response.data.data?.name
            });
        } catch (err) {
            const errorMessage = 'Failed to load product details';
            setError(errorMessage);
            logger.error(errorMessage, { productId: id, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const loadRelatedProducts = async () => {
        try {
            const response = await apiClient.get(`/products?limit=4&exclude=${id}`);
            setRelatedProducts(response.data.data || []);
        } catch (err) {
            logger.error('Failed to load related products', { error: err.message });
        }
    };

    const handleAddToCart = async () => {
        try {
            setAddingToCart(true);

            // Get current cart from localStorage
            const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

            // Check if product already exists in cart
            const existingItemIndex = currentCart.findIndex(item => item.productId === product.id);

            if (existingItemIndex >= 0) {
                // Update quantity
                currentCart[existingItemIndex].quantity += quantity;
            } else {
                // Add new item
                currentCart.push({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: quantity,
                    image: product.image_url
                });
            }

            // Save to localStorage
            localStorage.setItem('cart', JSON.stringify(currentCart));

            // Update cart count in header
            if (updateCartCount) {
                const newCount = currentCart.reduce((total, item) => total + item.quantity, 0);
                updateCartCount(newCount);
            }

            logger.info('Product added to cart', {
                productId: product.id,
                quantity: quantity
            });

            // Show success message (you could use a toast notification here)
            alert(`${product.name} added to cart!`);

        } catch (err) {
            logger.error('Failed to add product to cart', { error: err.message });
            alert('Failed to add product to cart. Please try again.');
        } finally {
            setAddingToCart(false);
        }
    };

    const checkWishlistStatus = () => {
        try {
            const wishlistData = localStorage.getItem('wishlist');
            if (wishlistData) {
                const wishlist = JSON.parse(wishlistData);
                setIsInWishlist(wishlist.some(item => item.id === id));
            }
        } catch (err) {
            logger.error('Failed to check wishlist status', { error: err.message });
        }
    };

    const handleToggleWishlist = async () => {
        try {
            setAddingToWishlist(true);

            const wishlistData = localStorage.getItem('wishlist');
            let wishlist = wishlistData ? JSON.parse(wishlistData) : [];

            if (isInWishlist) {
                // Remove from wishlist
                wishlist = wishlist.filter(item => item.id !== product.id);
                setIsInWishlist(false);
                logger.info('Product removed from wishlist', { productId: product.id });
            } else {
                // Add to wishlist
                wishlist.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url
                });
                setIsInWishlist(true);
                logger.info('Product added to wishlist', { productId: product.id });
            }

            localStorage.setItem('wishlist', JSON.stringify(wishlist));

        } catch (err) {
            logger.error('Failed to update wishlist', { error: err.message });
            alert('Failed to update wishlist. Please try again.');
        } finally {
            setAddingToWishlist(false);
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

    const breadcrumbStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '2rem',
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    const breadcrumbLinkStyle = {
        color: '#2563eb',
        textDecoration: 'none'
    };

    const contentStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const productGridStyle = {
        display: 'grid',
        gridTemplateColumns: window.innerWidth >= 768 ? '1fr 1fr' : '1fr',
        gap: '3rem',
        marginBottom: '3rem'
    };

    const imageGalleryStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
    };

    const mainImageStyle = {
        width: '100%',
        height: '24rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '4rem',
        overflow: 'hidden'
    };

    const thumbnailsStyle = {
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto'
    };

    const thumbnailStyle = (isSelected) => ({
        width: '4rem',
        height: '4rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
        flexShrink: 0
    });

    const productInfoStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
    };

    const titleStyle = {
        fontSize: '2rem',
        fontWeight: '800',
        color: '#111827'
    };

    const ratingStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const priceStyle = {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#111827'
    };

    const descriptionStyle = {
        fontSize: '1rem',
        color: '#6b7280',
        lineHeight: '1.6'
    };

    const quantityStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    };

    const quantityControlStyle = {
        display: 'flex',
        alignItems: 'center',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem'
    };

    const quantityButtonStyle = {
        padding: '0.5rem 0.75rem',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600'
    };

    const quantityInputStyle = {
        width: '3rem',
        padding: '0.5rem',
        border: 'none',
        textAlign: 'center',
        fontSize: '1rem'
    };

    const addToCartButtonStyle = {
        padding: '1rem 2rem',
        backgroundColor: addingToCart ? '#9ca3af' : '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: addingToCart ? 'not-allowed' : 'pointer',
        width: '100%'
    };

    const wishlistButtonStyle = {
        padding: '1rem 2rem',
        backgroundColor: addingToWishlist ? '#9ca3af' : (isInWishlist ? '#dc2626' : 'white'),
        color: isInWishlist ? 'white' : '#374151',
        border: isInWishlist ? 'none' : '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: addingToWishlist ? 'not-allowed' : 'pointer',
        width: '100%',
        marginTop: '0.75rem'
    };

    const buttonGroupStyle = {
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem'
    };

    const relatedSectionStyle = {
        marginTop: '3rem'
    };

    const sectionTitleStyle = {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1.5rem'
    };

    const relatedGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem'
    };

    const relatedCardStyle = {
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        transition: 'transform 0.2s'
    };

    const relatedImageStyle = {
        width: '100%',
        height: '8rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem'
    };

    const relatedContentStyle = {
        padding: '1rem'
    };

    const relatedNameStyle = {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const relatedPriceStyle = {
        fontSize: '1rem',
        fontWeight: '700',
        color: '#111827'
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

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={loadingStyle}>Loading product details...</div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={errorStyle}>
                        <p>{error || 'Product not found'}</p>
                        <button
                            onClick={() => navigate('/products')}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer'
                            }}
                        >
                            Back to Products
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Mock images for demonstration
    const images = product.image_url ? [product.image_url] : [];

    return (
        <div style={containerStyle}>
            <div style={innerContainerStyle}>
                {/* Breadcrumb */}
                <nav style={breadcrumbStyle}>
                    <Link to="/" style={breadcrumbLinkStyle}>Home</Link>
                    <span>›</span>
                    <Link to="/products" style={breadcrumbLinkStyle}>Products</Link>
                    <span>›</span>
                    <span>{product.name}</span>
                </nav>

                <div style={contentStyle}>
                    {/* Product Details */}
                    <div style={productGridStyle}>
                        {/* Image Gallery */}
                        <div style={imageGalleryStyle}>
                            <div style={mainImageStyle}>
                                {images.length > 0 ? (
                                    <img
                                        src={images[selectedImage]}
                                        alt={product.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span>📦</span>
                                )}
                            </div>

                            {images.length > 1 && (
                                <div style={thumbnailsStyle}>
                                    {images.map((image, index) => (
                                        <div
                                            key={index}
                                            style={thumbnailStyle(index === selectedImage)}
                                            onClick={() => setSelectedImage(index)}
                                        >
                                            <img
                                                src={image}
                                                alt={`${product.name} ${index + 1}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Info */}
                        <div style={productInfoStyle}>
                            <h1 style={titleStyle}>{product.name}</h1>

                            <div style={ratingStyle}>
                                <span style={{ color: '#facc15' }}>⭐⭐⭐⭐⭐</span>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    4.5 (24 reviews)
                                </span>
                            </div>

                            <div style={priceStyle}>
                                ${parseFloat(product.price).toFixed(2)}
                            </div>

                            {product.description && (
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                        Description
                                    </h3>
                                    <p style={descriptionStyle}>{product.description}</p>
                                </div>
                            )}

                            <div style={quantityStyle}>
                                <span style={{ fontSize: '1rem', fontWeight: '600' }}>Quantity:</span>
                                <div style={quantityControlStyle}>
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        style={quantityButtonStyle}
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        style={quantityInputStyle}
                                        min="1"
                                    />
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        style={quantityButtonStyle}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div style={buttonGroupStyle}>
                                <button
                                    onClick={handleAddToCart}
                                    disabled={addingToCart}
                                    style={{ ...addToCartButtonStyle, flex: 2 }}
                                >
                                    {addingToCart ? 'Adding to Cart...' : 'Add to Cart'}
                                </button>

                                <button
                                    onClick={handleToggleWishlist}
                                    disabled={addingToWishlist}
                                    style={{ ...wishlistButtonStyle, flex: 1, marginTop: 0 }}
                                    title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                                >
                                    {addingToWishlist ? '...' : (isInWishlist ? '❤️' : '🤍')}
                                </button>
                            </div>

                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                <p>✓ Free shipping on orders over $50</p>
                                <p>✓ 30-day return policy</p>
                                <p>✓ Secure payment processing</p>
                            </div>
                        </div>
                    </div>

                    {/* Related Products */}
                    {relatedProducts.length > 0 && (
                        <div style={relatedSectionStyle}>
                            <h2 style={sectionTitleStyle}>Related Products</h2>
                            <div style={relatedGridStyle}>
                                {relatedProducts.map((relatedProduct) => (
                                    <Link
                                        key={relatedProduct.id}
                                        to={`/products/${relatedProduct.id}`}
                                        style={{ textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <div style={relatedCardStyle}>
                                            <div style={relatedImageStyle}>
                                                {relatedProduct.image_url ? (
                                                    <img
                                                        src={relatedProduct.image_url}
                                                        alt={relatedProduct.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <span>📦</span>
                                                )}
                                            </div>
                                            <div style={relatedContentStyle}>
                                                <h3 style={relatedNameStyle}>{relatedProduct.name}</h3>
                                                <p style={relatedPriceStyle}>
                                                    ${parseFloat(relatedProduct.price).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;