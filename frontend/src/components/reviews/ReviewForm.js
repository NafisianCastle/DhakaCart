import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const ReviewForm = ({ productId, onSubmit, onCancel, existingReview = null }) => {
    const [formData, setFormData] = useState({
        rating: existingReview?.rating || 0,
        title: existingReview?.title || '',
        reviewText: existingReview?.review_text || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRatingClick = (rating) => {
        setFormData(prev => ({ ...prev, rating }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.rating === 0) {
            setError('Please select a rating');
            return;
        }

        if (!formData.reviewText.trim()) {
            setError('Please write a review');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setError('Please log in to submit a review');
                return;
            }

            const url = existingReview
                ? `/api/reviews/${existingReview.id}`
                : `/api/reviews`;

            const method = existingReview ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    productId,
                    rating: formData.rating,
                    title: formData.title.trim() || null,
                    reviewText: formData.reviewText.trim()
                })
            });

            const data = await response.json();

            if (data.success) {
                onSubmit(data.data.review);
            } else {
                setError(data.error || 'Failed to submit review');
            }
        } catch (err) {
            setError('Failed to submit review. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStars = () => {
        return (
            <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingClick(star)}
                        className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                        {star <= formData.rating ? (
                            <StarIconSolid className="w-8 h-8 text-yellow-400 hover:text-yellow-500 transition-colors" />
                        ) : (
                            <StarIcon className="w-8 h-8 text-gray-300 hover:text-yellow-400 transition-colors" />
                        )}
                    </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">
                    {formData.rating > 0 ? `${formData.rating} star${formData.rating !== 1 ? 's' : ''}` : 'Select rating'}
                </span>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">
                {existingReview ? 'Edit Your Review' : 'Write a Review'}
            </h3>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Rating */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Rating <span className="text-red-500">*</span>
                    </label>
                    {renderStars()}
                </div>

                {/* Title */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium mb-2">
                        Review Title (optional)
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Summarize your review in a few words"
                        maxLength={100}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        {formData.title.length}/100 characters
                    </div>
                </div>

                {/* Review Text */}
                <div>
                    <label htmlFor="reviewText" className="block text-sm font-medium mb-2">
                        Your Review <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        id="reviewText"
                        value={formData.reviewText}
                        onChange={(e) => setFormData(prev => ({ ...prev, reviewText: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows="5"
                        placeholder="Share your experience with this product..."
                        maxLength={2000}
                        required
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        {formData.reviewText.length}/2000 characters
                    </div>
                </div>

                {/* Guidelines */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">Review Guidelines</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Be honest and helpful to other customers</li>
                        <li>• Focus on the product's features and your experience</li>
                        <li>• Avoid inappropriate language or personal information</li>
                        <li>• Reviews are moderated and may take time to appear</li>
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4">
                    <button
                        type="submit"
                        disabled={loading || formData.rating === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Submitting...' : (existingReview ? 'Update Review' : 'Submit Review')}
                    </button>

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReviewForm;