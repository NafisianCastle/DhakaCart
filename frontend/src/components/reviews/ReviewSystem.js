import React, { useState } from 'react';
import ProductReviews from './ProductReviews';
import ReviewForm from './ReviewForm';

const ReviewSystem = ({ productId, productName }) => {
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [refreshReviews, setRefreshReviews] = useState(0);

    const handleReviewSubmit = (newReview) => {
        // Refresh the reviews list
        setRefreshReviews(prev => prev + 1);
        setShowReviewForm(false);

        // Show success message
        alert('Review submitted successfully!');
    };

    const handleShowReviewForm = () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please log in to write a review');
            return;
        }
        setShowReviewForm(true);
    };

    return (
        <div className="space-y-6">
            {showReviewForm ? (
                <ReviewForm
                    productId={productId}
                    onSubmit={handleReviewSubmit}
                    onCancel={() => setShowReviewForm(false)}
                />
            ) : (
                <ProductReviews
                    productId={productId}
                    onReviewSubmit={handleShowReviewForm}
                    key={refreshReviews} // Force re-render when reviews are updated
                />
            )}
        </div>
    );
};

export default ReviewSystem;