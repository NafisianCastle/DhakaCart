import React, { useState } from 'react';
import './CouponValidator.css';

const CouponValidator = ({ orderAmount, onCouponApplied, onCouponRemoved, appliedCoupon }) => {
    const [couponCode, setCouponCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const validateCoupon = async () => {
        if (!couponCode.trim()) {
            setError('Please enter a coupon code');
            return;
        }

        if (!orderAmount || orderAmount <= 0) {
            setError('Invalid order amount');
            return;
        }

        try {
            setLoading(true);
            setError('');
            setSuccess('');

            const response = await fetch(
                `/api/promotions/coupons/${encodeURIComponent(couponCode.trim())}/validate?orderAmount=${orderAmount}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to validate coupon');
            }

            if (data.valid) {
                setSuccess(`Coupon applied! You save $${data.discount.toFixed(2)}`);
                setCouponCode('');

                if (onCouponApplied) {
                    onCouponApplied({
                        code: data.coupon.code,
                        name: data.coupon.name,
                        discount: data.discount,
                        couponData: data.coupon
                    });
                }
            } else {
                setError(data.error || 'Invalid coupon code');
            }
        } catch (err) {
            console.error('Error validating coupon:', err);
            setError(err.message || 'Failed to validate coupon');
        } finally {
            setLoading(false);
        }
    };

    const removeCoupon = () => {
        setError('');
        setSuccess('');

        if (onCouponRemoved) {
            onCouponRemoved();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        validateCoupon();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateCoupon();
        }
    };

    return (
        <div className="coupon-validator">
            <div className="coupon-validator__header">
                <h3 className="coupon-validator__title">
                    <span className="coupon-validator__icon">🎫</span>
                    Promo Code
                </h3>
            </div>

            {appliedCoupon ? (
                <div className="coupon-validator__applied">
                    <div className="applied-coupon">
                        <div className="applied-coupon__info">
                            <span className="applied-coupon__code">{appliedCoupon.code}</span>
                            <span className="applied-coupon__name">{appliedCoupon.name}</span>
                            <span className="applied-coupon__discount">
                                -${appliedCoupon.discount.toFixed(2)}
                            </span>
                        </div>
                        <button
                            className="applied-coupon__remove"
                            onClick={removeCoupon}
                            title="Remove coupon"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ) : (
                <form className="coupon-validator__form" onSubmit={handleSubmit}>
                    <div className="coupon-validator__input-group">
                        <input
                            type="text"
                            className="coupon-validator__input"
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            maxLength={20}
                        />
                        <button
                            type="submit"
                            className="coupon-validator__button"
                            disabled={loading || !couponCode.trim()}
                        >
                            {loading ? (
                                <span className="coupon-validator__spinner">⟳</span>
                            ) : (
                                'Apply'
                            )}
                        </button>
                    </div>
                </form>
            )}

            {error && (
                <div className="coupon-validator__message coupon-validator__message--error">
                    <span className="message-icon">⚠️</span>
                    {error}
                </div>
            )}

            {success && (
                <div className="coupon-validator__message coupon-validator__message--success">
                    <span className="message-icon">✅</span>
                    {success}
                </div>
            )}

            <div className="coupon-validator__suggestions">
                <p className="suggestions-title">Available Offers:</p>
                <div className="suggestions-list">
                    <span className="suggestion-item">WELCOME10 - 10% off first order</span>
                    <span className="suggestion-item">FREESHIP - Free shipping over $50</span>
                    <span className="suggestion-item">SAVE20 - $20 off orders over $100</span>
                </div>
            </div>
        </div>
    );
};

export default CouponValidator;