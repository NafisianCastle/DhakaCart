import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const CheckoutPage = () => {
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Shipping Information
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',

        // Payment Information
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        cardName: '',

        // Order Notes
        orderNotes: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadCartItems();
        loadUserData();
    }, []);

    const loadCartItems = () => {
        try {
            const cartData = localStorage.getItem('cart');
            if (cartData) {
                const cart = JSON.parse(cartData);
                setCartItems(cart);

                if (cart.length === 0) {
                    navigate('/cart');
                }
            } else {
                navigate('/cart');
            }
        } catch (error) {
            logger.error('Failed to load cart items', { error: error.message });
            navigate('/cart');
        }
    };

    const loadUserData = () => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                setFormData(prev => ({
                    ...prev,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || '',
                    phone: user.phone || ''
                }));
            }
        } catch (error) {
            logger.error('Failed to load user data', { error: error.message });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    const validateStep = (step) => {
        const newErrors = {};

        if (step === 1) {
            // Validate shipping information
            if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
            if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
            if (!formData.email.trim()) newErrors.email = 'Email is required';
            else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
            if (!formData.address.trim()) newErrors.address = 'Address is required';
            if (!formData.city.trim()) newErrors.city = 'City is required';
            if (!formData.state.trim()) newErrors.state = 'State is required';
            if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
        }

        if (step === 2) {
            // Validate payment information
            if (!formData.cardNumber.trim()) newErrors.cardNumber = 'Card number is required';
            else if (formData.cardNumber.replace(/\s/g, '').length < 16) newErrors.cardNumber = 'Card number is invalid';
            if (!formData.expiryDate.trim()) newErrors.expiryDate = 'Expiry date is required';
            if (!formData.cvv.trim()) newErrors.cvv = 'CVV is required';
            else if (formData.cvv.length < 3) newErrors.cvv = 'CVV is invalid';
            if (!formData.cardName.trim()) newErrors.cardName = 'Cardholder name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePreviousStep = () => {
        setCurrentStep(currentStep - 1);
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

    const handlePlaceOrder = async () => {
        if (!validateStep(2)) {
            return;
        }

        setLoading(true);

        try {
            const orderData = {
                items: cartItems,
                shippingAddress: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: formData.country
                },
                paymentMethod: {
                    cardNumber: formData.cardNumber.replace(/\s/g, ''),
                    expiryDate: formData.expiryDate,
                    cvv: formData.cvv,
                    cardName: formData.cardName
                },
                orderNotes: formData.orderNotes,
                subtotal: calculateSubtotal(),
                tax: calculateTax(calculateSubtotal()),
                shipping: calculateShipping(calculateSubtotal()),
                total: calculateTotal()
            };

            logger.info('Placing order', {
                itemCount: cartItems.length,
                total: orderData.total
            });

            // In a real app, this would call the backend API
            // const response = await apiClient.post('/orders', orderData);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Clear cart
            localStorage.removeItem('cart');

            logger.info('Order placed successfully');

            // Redirect to success page
            navigate('/order-success', {
                state: {
                    orderId: 'ORD-' + Date.now(),
                    total: orderData.total
                }
            });

        } catch (error) {
            logger.error('Failed to place order', { error: error.message });
            alert('Failed to place order. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = matches && matches[0] || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        if (parts.length) {
            return parts.join(' ');
        } else {
            return v;
        }
    };

    const handleCardNumberChange = (e) => {
        const formatted = formatCardNumber(e.target.value);
        setFormData(prev => ({
            ...prev,
            cardNumber: formatted
        }));
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

    const stepIndicatorStyle = {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2rem'
    };

    const stepStyle = (stepNumber) => ({
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.875rem',
        color: stepNumber <= currentStep ? '#2563eb' : '#6b7280'
    });

    const stepCircleStyle = (stepNumber) => ({
        width: '2rem',
        height: '2rem',
        borderRadius: '50%',
        backgroundColor: stepNumber <= currentStep ? '#2563eb' : '#e5e7eb',
        color: stepNumber <= currentStep ? 'white' : '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '600',
        marginRight: '0.5rem'
    });

    const contentStyle = {
        display: 'grid',
        gridTemplateColumns: window.innerWidth >= 768 ? '2fr 1fr' : '1fr',
        gap: '2rem'
    };

    const formSectionStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const sectionTitleStyle = {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1.5rem'
    };

    const formRowStyle = {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem'
    };

    const formGroupStyle = {
        flex: 1,
        marginBottom: '1rem'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.25rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        boxSizing: 'border-box'
    };

    const errorInputStyle = {
        ...inputStyle,
        borderColor: '#dc2626'
    };

    const errorTextStyle = {
        color: '#dc2626',
        fontSize: '0.75rem',
        marginTop: '0.25rem'
    };

    const buttonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const secondaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db'
    };

    const summaryStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: 'fit-content'
    };

    const summaryItemStyle = {
        display: 'flex',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderBottom: '1px solid #e5e7eb'
    };

    const itemImageStyle = {
        width: '3rem',
        height: '3rem',
        background: 'linear-gradient(to bottom right, #dbeafe, #ede9fe)',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        marginRight: '0.75rem',
        flexShrink: 0
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

    if (cartItems.length === 0) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Your cart is empty</h2>
                        <button onClick={() => navigate('/products')} style={buttonStyle}>
                            Continue Shopping
                        </button>
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
                    <h1 style={titleStyle}>Checkout</h1>

                    {/* Step Indicator */}
                    <div style={stepIndicatorStyle}>
                        <div style={stepStyle(1)}>
                            <div style={stepCircleStyle(1)}>1</div>
                            <span>Shipping</span>
                        </div>
                        <div style={{ margin: '0 1rem', color: '#d1d5db' }}>→</div>
                        <div style={stepStyle(2)}>
                            <div style={stepCircleStyle(2)}>2</div>
                            <span>Payment</span>
                        </div>
                        <div style={{ margin: '0 1rem', color: '#d1d5db' }}>→</div>
                        <div style={stepStyle(3)}>
                            <div style={stepCircleStyle(3)}>3</div>
                            <span>Review</span>
                        </div>
                    </div>
                </div>

                <div style={contentStyle}>
                    {/* Form Section */}
                    <div style={formSectionStyle}>
                        {currentStep === 1 && (
                            <div>
                                <h2 style={sectionTitleStyle}>Shipping Information</h2>

                                <div style={formRowStyle}>
                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>First Name *</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            style={errors.firstName ? errorInputStyle : inputStyle}
                                        />
                                        {errors.firstName && <div style={errorTextStyle}>{errors.firstName}</div>}
                                    </div>

                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>Last Name *</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            style={errors.lastName ? errorInputStyle : inputStyle}
                                        />
                                        {errors.lastName && <div style={errorTextStyle}>{errors.lastName}</div>}
                                    </div>
                                </div>

                                <div style={formRowStyle}>
                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            style={errors.email ? errorInputStyle : inputStyle}
                                        />
                                        {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
                                    </div>

                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>Phone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Address *</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        style={errors.address ? errorInputStyle : inputStyle}
                                    />
                                    {errors.address && <div style={errorTextStyle}>{errors.address}</div>}
                                </div>

                                <div style={formRowStyle}>
                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>City *</label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            style={errors.city ? errorInputStyle : inputStyle}
                                        />
                                        {errors.city && <div style={errorTextStyle}>{errors.city}</div>}
                                    </div>

                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>State *</label>
                                        <input
                                            type="text"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleInputChange}
                                            style={errors.state ? errorInputStyle : inputStyle}
                                        />
                                        {errors.state && <div style={errorTextStyle}>{errors.state}</div>}
                                    </div>

                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>ZIP Code *</label>
                                        <input
                                            type="text"
                                            name="zipCode"
                                            value={formData.zipCode}
                                            onChange={handleInputChange}
                                            style={errors.zipCode ? errorInputStyle : inputStyle}
                                        />
                                        {errors.zipCode && <div style={errorTextStyle}>{errors.zipCode}</div>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                    <button onClick={handleNextStep} style={buttonStyle}>
                                        Continue to Payment
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div>
                                <h2 style={sectionTitleStyle}>Payment Information</h2>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Card Number *</label>
                                    <input
                                        type="text"
                                        name="cardNumber"
                                        value={formData.cardNumber}
                                        onChange={handleCardNumberChange}
                                        placeholder="1234 5678 9012 3456"
                                        maxLength="19"
                                        style={errors.cardNumber ? errorInputStyle : inputStyle}
                                    />
                                    {errors.cardNumber && <div style={errorTextStyle}>{errors.cardNumber}</div>}
                                </div>

                                <div style={formRowStyle}>
                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>Expiry Date *</label>
                                        <input
                                            type="text"
                                            name="expiryDate"
                                            value={formData.expiryDate}
                                            onChange={handleInputChange}
                                            placeholder="MM/YY"
                                            maxLength="5"
                                            style={errors.expiryDate ? errorInputStyle : inputStyle}
                                        />
                                        {errors.expiryDate && <div style={errorTextStyle}>{errors.expiryDate}</div>}
                                    </div>

                                    <div style={formGroupStyle}>
                                        <label style={labelStyle}>CVV *</label>
                                        <input
                                            type="text"
                                            name="cvv"
                                            value={formData.cvv}
                                            onChange={handleInputChange}
                                            placeholder="123"
                                            maxLength="4"
                                            style={errors.cvv ? errorInputStyle : inputStyle}
                                        />
                                        {errors.cvv && <div style={errorTextStyle}>{errors.cvv}</div>}
                                    </div>
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Cardholder Name *</label>
                                    <input
                                        type="text"
                                        name="cardName"
                                        value={formData.cardName}
                                        onChange={handleInputChange}
                                        style={errors.cardName ? errorInputStyle : inputStyle}
                                    />
                                    {errors.cardName && <div style={errorTextStyle}>{errors.cardName}</div>}
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Order Notes (Optional)</label>
                                    <textarea
                                        name="orderNotes"
                                        value={formData.orderNotes}
                                        onChange={handleInputChange}
                                        rows="3"
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                        placeholder="Any special instructions for your order..."
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                                    <button onClick={handlePreviousStep} style={secondaryButtonStyle}>
                                        Back to Shipping
                                    </button>
                                    <button onClick={handleNextStep} style={buttonStyle}>
                                        Review Order
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div>
                                <h2 style={sectionTitleStyle}>Review Your Order</h2>

                                <div style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                                        Shipping Address
                                    </h3>
                                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem' }}>
                                        <p>{formData.firstName} {formData.lastName}</p>
                                        <p>{formData.address}</p>
                                        <p>{formData.city}, {formData.state} {formData.zipCode}</p>
                                        <p>{formData.email}</p>
                                        {formData.phone && <p>{formData.phone}</p>}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                                        Payment Method
                                    </h3>
                                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem' }}>
                                        <p>**** **** **** {formData.cardNumber.slice(-4)}</p>
                                        <p>{formData.cardName}</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                                    <button onClick={handlePreviousStep} style={secondaryButtonStyle}>
                                        Back to Payment
                                    </button>
                                    <button
                                        onClick={handlePlaceOrder}
                                        disabled={loading}
                                        style={{
                                            ...buttonStyle,
                                            backgroundColor: loading ? '#9ca3af' : '#059669',
                                            cursor: loading ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {loading ? 'Placing Order...' : 'Place Order'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Summary */}
                    <div style={summaryStyle}>
                        <h2 style={sectionTitleStyle}>Order Summary</h2>

                        {cartItems.map((item) => (
                            <div key={item.productId} style={summaryItemStyle}>
                                <div style={itemImageStyle}>
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
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
                                        {item.name}
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                                        Qty: {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                                    </p>
                                </div>
                                <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                    ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </div>
                            </div>
                        ))}

                        <div style={{ marginTop: '1rem' }}>
                            <div style={summaryRowStyle}>
                                <span>Subtotal</span>
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

                            <div style={summaryTotalStyle}>
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '1rem',
                            textAlign: 'center'
                        }}>
                            <p>✓ Secure SSL encryption</p>
                            <p>✓ 30-day money-back guarantee</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;