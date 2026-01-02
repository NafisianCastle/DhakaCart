import React, { useState, useEffect } from 'react';
import './FlashSales.css';

const FlashSales = () => {
    const [flashSales, setFlashSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchFlashSales();
    }, []);

    const fetchFlashSales = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/promotions/flash-sales');

            if (!response.ok) {
                throw new Error('Failed to fetch flash sales');
            }

            const data = await response.json();
            setFlashSales(data.flashSales || []);
        } catch (err) {
            console.error('Error fetching flash sales:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatTimeRemaining = (expiresAt) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;

        if (diff <= 0) {
            return 'Expired';
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className="flash-sale__badge flash-sale__badge--active">🔥 Live Now</span>;
            case 'upcoming':
                return <span className="flash-sale__badge flash-sale__badge--upcoming">⏰ Coming Soon</span>;
            case 'expired':
                return <span className="flash-sale__badge flash-sale__badge--expired">⏰ Ended</span>;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flash-sales">
                <div className="flash-sales__header">
                    <h2 className="flash-sales__title">⚡ Flash Sales</h2>
                </div>
                <div className="flash-sales__loading">
                    <div className="flash-sale-skeleton">
                        <div className="skeleton-badge"></div>
                        <div className="skeleton-title"></div>
                        <div className="skeleton-description"></div>
                        <div className="skeleton-timer"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flash-sales">
                <div className="flash-sales__error">
                    <span className="error-icon">⚠️</span>
                    <p>Unable to load flash sales</p>
                </div>
            </div>
        );
    }

    if (flashSales.length === 0) {
        return (
            <div className="flash-sales">
                <div className="flash-sales__empty">
                    <span className="empty-icon">⚡</span>
                    <p>No flash sales available right now</p>
                    <small>Check back later for amazing deals!</small>
                </div>
            </div>
        );
    }

    return (
        <div className="flash-sales">
            <div className="flash-sales__header">
                <h2 className="flash-sales__title">
                    <span className="title-icon">⚡</span>
                    Flash Sales
                </h2>
                <p className="flash-sales__subtitle">Limited time offers - Don't miss out!</p>
            </div>

            <div className="flash-sales__grid">
                {flashSales.map((sale) => (
                    <FlashSaleCard
                        key={sale.id}
                        sale={sale}
                        formatTimeRemaining={formatTimeRemaining}
                        getStatusBadge={getStatusBadge}
                    />
                ))}
            </div>
        </div>
    );
};

const FlashSaleCard = ({ sale, formatTimeRemaining, getStatusBadge }) => {
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showProducts, setShowProducts] = useState(false);

    const fetchProducts = async () => {
        if (products.length > 0) {
            setShowProducts(!showProducts);
            return;
        }

        try {
            setLoadingProducts(true);
            const response = await fetch(`/api/promotions/flash-sales/${sale.id}/products`);

            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }

            const data = await response.json();
            setProducts(data.products || []);
            setShowProducts(true);
        } catch (err) {
            console.error('Error fetching flash sale products:', err);
        } finally {
            setLoadingProducts(false);
        }
    };

    return (
        <div className={`flash-sale-card flash-sale-card--${sale.status}`}>
            <div className="flash-sale-card__header">
                {getStatusBadge(sale.status)}
                <h3 className="flash-sale-card__name">{sale.name}</h3>
                {sale.description && (
                    <p className="flash-sale-card__description">{sale.description}</p>
                )}
            </div>

            <div className="flash-sale-card__details">
                <div className="flash-sale-detail">
                    <span className="detail-label">Discount:</span>
                    <span className="detail-value discount-value">
                        {sale.discount_percentage}% OFF
                    </span>
                </div>

                <div className="flash-sale-detail">
                    <span className="detail-label">Products:</span>
                    <span className="detail-value">{sale.product_count || 0}</span>
                </div>

                {sale.status === 'active' && (
                    <div className="flash-sale-detail">
                        <span className="detail-label">Ends in:</span>
                        <span className="detail-value timer-value">
                            {formatTimeRemaining(sale.expires_at)}
                        </span>
                    </div>
                )}

                {sale.status === 'upcoming' && (
                    <div className="flash-sale-detail">
                        <span className="detail-label">Starts in:</span>
                        <span className="detail-value timer-value">
                            {formatTimeRemaining(sale.starts_at)}
                        </span>
                    </div>
                )}
            </div>

            <div className="flash-sale-card__actions">
                <button
                    className="flash-sale-card__button"
                    onClick={fetchProducts}
                    disabled={loadingProducts}
                >
                    {loadingProducts ? (
                        <span className="button-spinner">⟳</span>
                    ) : showProducts ? (
                        'Hide Products'
                    ) : (
                        'View Products'
                    )}
                </button>
            </div>

            {showProducts && (
                <div className="flash-sale-card__products">
                    {products.length > 0 ? (
                        <div className="products-grid">
                            {products.slice(0, 4).map((product) => (
                                <div key={product.id} className="product-item">
                                    <div className="product-info">
                                        <h4 className="product-name">{product.name}</h4>
                                        <div className="product-prices">
                                            <span className="original-price">
                                                ${product.original_price}
                                            </span>
                                            <span className="sale-price">
                                                ${product.sale_price}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="no-products">No products available</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default FlashSales;