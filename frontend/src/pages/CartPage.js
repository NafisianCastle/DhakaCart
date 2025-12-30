import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logger from '../logger';

const CartPage = ({ updateCartCount }) => {
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadCartItems();
    }, []);

    const loadCartItems = () => {
        try {
            const cartData = localStorage.getItem('cart');
            if (cartData) {
                const cart = JSON.parse(cartData);
                setCartItems(cart);
                logger.info('Cart items loaded', { itemCount: cart.length });
            }
        } catch (error) {
            logger.error('Failed to load cart items', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeItem(productId);
            return;
        }

        const updatedCart = cartItems.map(item =>
            item.productId === productId
                ? { ...item, quantity: newQuantity }
                : item
        );

        setCartItems(updatedCart);
        localStorage.setItem('cart', JSON.stringify(updatedCart));

        // Update cart count in header
        if (updateCartCount) {
            const newCount = updatedCart.reduce((total, item) => total + item.quantity, 0);
            updateCartCount(newCount);
        }

        logger.info('Cart item quantity updated', { productId, newQuantity });
    };

    const removeItem = (productId) => {
        const updatedCart = cartItems.filter(item => item.productId !== productId);
        setCartItems(updatedCart);
        localStorage.setItem('cart', JSON.stringify(updatedCart));

        // Update cart count in header
        if (updateCartCount) {
            const newCount = updatedCart.reduce((total, item) => total + item.quantity, 0);
            updateCartCount(newCount);
        }

        logger.info('Item removed from cart', { productId });
    };

    const clearCart = () => {
        setCartItems([]);
        localStorage.removeItem('cart');

        // Update cart count in header
        if (updateCartCount) {
            updateCartCount(0);
        }

        logger.info('Cart cleared');
    };

    const calculateSubtotal = () => {
        return cartItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0);
    };

    const calculateTax = (subtotal) => {
        return subtotal * 0.08; // 8% tax
    };

    const calculateShipping = (subtotal) => {
        return subtotal >= 50 ? 0 : 9.99; // Free shipping over $50
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        const tax = calculateTax(subtotal);
        const shipping = calculateShipping(subtotal);
        return subtotal + tax + shipping;
    };

    const handleCheckout = () => {
        if (cartItems.length === 0) {
            alert('Your cart is empty');
            return;
        }

        logger.info('Proceeding to checkout', {
            itemCount: cartItems.length,
            total: calculateTotal()
        });

        navigate('/checkout');
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
        gridTemplateColumns: window.innerWidth >= 768 ? '2fr 1fr' : '1fr',
        gap: '2rem'
    };

    const cartSectionStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const itemStyle = {
        display: 'flex',
        alignItems: 'center',
        padding: '1rem 0',
        borderBottom: '1px solid #e5e7eb'
    };

    const imageStyle = {
        width: '5rem',
        height: '5rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        marginRight: '1rem',
        flexShrink: 0
    };

    const itemInfoStyle = {
        flex: 1,
        marginRight: '1rem'
    };

    const itemNameStyle = {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.25rem'
    };

    const itemPriceStyle = {
        fontSize: '0.875rem',
        color: '#6b7280'
    };

    const quantityControlStyle = {
        display: 'flex',
        alignItems: 'center',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        marginRight: '1rem'
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
        fontSize: '0.875rem'
    };

    const removeButtonStyle = {
        padding: '0.5rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontSize: '0.875rem'
    };

    const totalPriceStyle = {
        fontSize: '1rem',
        fontWeight: '700',
        color: '#111827',
        minWidth: '5rem',
        textAlign: 'right'
    };

    const summaryStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: 'fit-content'
    };

    const summaryTitleStyle = {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1rem'
    };

    const summaryRowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        fontSize: '0.875rem'
    };

    const summaryTotalStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb',
        fontSize: '1.125rem',
        fontWeight: '700'
    };

    const checkoutButtonStyle = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '1rem'
    };

    const continueShoppingStyle = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '0.5rem',
        textDecoration: 'none',
        display: 'block',
        textAlign: 'center'
    };

    const clearCartButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '1rem'
    };

    const emptyCartStyle = {
        textAlign: 'center',
        padding: '4rem 2rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
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

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Loading cart...</h2>
                    </div>
                </div>
            </div>
        );
    }

    if (cartItems.length === 0) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={headerStyle}>
                        <h1 style={titleStyle}>Shopping Cart</h1>
                    </div>

                    <div style={emptyCartStyle}>
                        <div style={emptyIconStyle}>🛒</div>
                        <h2 style={emptyTitleStyle}>Your cart is empty</h2>
                        <p style={emptyDescStyle}>
                            Looks like you haven't added any items to your cart yet.
                        </p>
                        <Link to="/products" style={checkoutButtonStyle}>
                            Start Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    const shipping = calculateShipping(subtotal);
    const total = calculateTotal();

    return (
        <div style={containerStyle}>
            <div style={innerContainerStyle}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>Shopping Cart</h1>
                    <p style={subtitleStyle}>
                        {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart
                    </p>
                </div>

                <div style={contentStyle}>
                    {/* Cart Items */}
                    <div style={cartSectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                                Cart Items
                            </h2>
                            <button onClick={clearCart} style={clearCartButtonStyle}>
                                Clear Cart
                            </button>
                        </div>

                        {cartItems.map((item) => (
                            <div key={item.productId} style={itemStyle}>
                                <div style={imageStyle}>
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.375rem' }}
                                        />
                                    ) : (
                                        <span>📦</span>
                                    )}
                                </div>

                                <div style={itemInfoStyle}>
                                    <h3 style={itemNameStyle}>
                                        <Link
                                            to={`/products/${item.productId}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            {item.name}
                                        </Link>
                                    </h3>
                                    <p style={itemPriceStyle}>
                                        ${parseFloat(item.price).toFixed(2)} each
                                    </p>
                                </div>

                                <div style={quantityControlStyle}>
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                        style={quantityButtonStyle}
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                                        style={quantityInputStyle}
                                        min="1"
                                    />
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                        style={quantityButtonStyle}
                                    >
                                        +
                                    </button>
                                </div>

                                <button
                                    onClick={() => removeItem(item.productId)}
                                    style={removeButtonStyle}
                                    title="Remove item"
                                >
                                    ✕
                                </button>

                                <div style={totalPriceStyle}>
                                    ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <div style={summaryStyle}>
                        <h2 style={summaryTitleStyle}>Order Summary</h2>

                        <div style={summaryRowStyle}>
                            <span>Subtotal ({cartItems.length} items)</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>

                        <div style={summaryRowStyle}>
                            <span>Shipping</span>
                            <span>{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                        </div>

                        <div style={summaryRowStyle}>
                            <span>Tax</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>

                        {shipping === 0 && (
                            <div style={{
                                fontSize: '0.875rem',
                                color: '#059669',
                                marginBottom: '0.75rem',
                                fontWeight: '500'
                            }}>
                                ✓ You qualify for free shipping!
                            </div>
                        )}

                        {subtotal < 50 && (
                            <div style={{
                                fontSize: '0.875rem',
                                color: '#d97706',
                                marginBottom: '0.75rem'
                            }}>
                                Add ${(50 - subtotal).toFixed(2)} more for free shipping
                            </div>
                        )}

                        <div style={summaryTotalStyle}>
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>

                        <button onClick={handleCheckout} style={checkoutButtonStyle}>
                            Proceed to Checkout
                        </button>

                        <Link to="/products" style={continueShoppingStyle}>
                            Continue Shopping
                        </Link>

                        <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '1rem',
                            textAlign: 'center'
                        }}>
                            <p>✓ Secure checkout</p>
                            <p>✓ 30-day return policy</p>
                            <p>✓ Customer support</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartPage;