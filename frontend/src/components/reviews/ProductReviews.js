import React, { useState, useEffect } from 'react';
import {
    StarIcon,
    HandThumbUpIcon,
    HandThumbDownIcon,
    ExclamationTriangleIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const ProductReviews = ({ productId, onReviewSubmit }) => {
    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        rating: null,
        verifiedOnly: false,
        sortBy: 'created_at',
        sortOrder: 'DESC'
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });

    // Fetch reviews and stats
    useEffect(() => {
        fetchReviews();
        fetchStats();
    }, [productId, filters, pagination.page]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                ...(filters.rating && { rating: filters.rating }),
                ...(filters.verifiedOnly && { verifiedOnly: 'true' })
            });

            const response = await fetch(`/api/reviews/products/${productId}?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                setReviews(data.data.reviews);
                setPagination(prev => ({
                    ...prev,
                    total: data.data.pagination.total,
                    totalPages: data.data.pagination.totalPages
                }));
            } else {
                setError('Failed to load reviews');
            }
        } catch (err) {
            setError('Failed to load reviews');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`/api/reviews/products/${productId}/stats`);
            const data = await response.json();

            if (data.success) {
                setStats(data.data.stats);
            }
        } catch (err) {
            console.error('Failed to load review stats:', err);
        }
    };

    const handleFilterChange = (newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleHelpfulVote = async (reviewId, isHelpful) => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Please log in to vote on reviews');
                return;
            }

            const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isHelpful })
            });

            if (response.ok) {
                // Refresh reviews to show updated helpful count
                fetchReviews();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to vote on review');
            }
        } catch (err) {
            alert('Failed to vote on review');
        }
    };

    const handleReportReview = async (reviewId, reason, description) => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Please log in to report reviews');
                return;
            }

            const response = await fetch(`/api/reviews/${reviewId}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason, description })
            });

            if (response.ok) {
                alert('Review reported successfully');
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to report review');
            }
        } catch (err) {
            alert('Failed to report review');
        }
    };

    const renderStars = (rating, size = 'w-4 h-4') => {
        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <StarIconSolid
                        key={star}
                        className={`${size} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                    />
                ))}
            </div>
        );
    };

    const renderRatingDistribution = () => {
        if (!stats || !stats.ratingDistribution) return null;

        const distribution = stats.ratingDistribution;
        const total = stats.reviewCount;

        return (
            <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                    const count = distribution[rating] || 0;
                    const percentage = total > 0 ? (count / total) * 100 : 0;

                    return (
                        <div key={rating} className="flex items-center space-x-2 text-sm">
                            <button
                                onClick={() => handleFilterChange({
                                    rating: filters.rating === rating ? null : rating
                                })}
                                className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${filters.rating === rating
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'hover:bg-gray-100'
                                    }`}
                            >
                                <span>{rating}</span>
                                <StarIconSolid className="w-3 h-3 text-yellow-400" />
                            </button>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <span className="text-gray-600 w-8 text-right">{count}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading && reviews.length === 0) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Review Summary */}
            {stats && (
                <div className="bg-white rounded-lg border p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Customer Reviews</h3>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    {renderStars(Math.round(stats.averageRating), 'w-5 h-5')}
                                    <span className="text-lg font-medium">{stats.averageRating.toFixed(1)}</span>
                                    <span className="text-gray-500">({stats.reviewCount} reviews)</span>
                                </div>
                            </div>
                        </div>

                        {onReviewSubmit && (
                            <button
                                onClick={onReviewSubmit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Write a Review
                            </button>
                        )}
                    </div>

                    {/* Rating Distribution */}
                    <div className="mt-6">
                        <h4 className="font-medium mb-3">Rating Breakdown</h4>
                        {renderRatingDistribution()}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Sort by:</label>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
                            className="border rounded px-3 py-1 text-sm"
                        >
                            <option value="created_at">Most Recent</option>
                            <option value="helpful_count">Most Helpful</option>
                            <option value="rating">Highest Rating</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="verifiedOnly"
                            checked={filters.verifiedOnly}
                            onChange={(e) => handleFilterChange({ verifiedOnly: e.target.checked })}
                            className="rounded"
                        />
                        <label htmlFor="verifiedOnly" className="text-sm">
                            Verified purchases only
                        </label>
                    </div>

                    {filters.rating && (
                        <button
                            onClick={() => handleFilterChange({ rating: null })}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                        >
                            Clear rating filter ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <StarIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No reviews yet. Be the first to review this product!</p>
                    </div>
                ) : (
                    reviews.map((review) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            onHelpfulVote={handleHelpfulVote}
                            onReport={handleReportReview}
                        />
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2">
                    <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Previous
                    </button>

                    <span className="px-4 py-2 text-sm text-gray-600">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                        className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

// Individual Review Card Component
const ReviewCard = ({ review, onHelpfulVote, onReport }) => {
    const [showReportForm, setShowReportForm] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDescription, setReportDescription] = useState('');

    const handleReport = () => {
        if (!reportReason) {
            alert('Please select a reason for reporting');
            return;
        }

        onReport(review.id, reportReason, reportDescription);
        setShowReportForm(false);
        setReportReason('');
        setReportDescription('');
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <StarIconSolid
                        key={star}
                        className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            {/* Review Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <UserCircleIcon className="w-10 h-10 text-gray-400" />
                    <div>
                        <div className="flex items-center space-x-2">
                            <span className="font-medium">
                                {review.user.firstName} {review.user.lastName?.charAt(0)}.
                            </span>
                            {review.is_verified_purchase && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                    Verified Purchase
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                            {renderStars(review.rating)}
                            <span className="text-sm text-gray-500">
                                {new Date(review.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowReportForm(!showReportForm)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Report review"
                >
                    <ExclamationTriangleIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Review Content */}
            {review.title && (
                <h4 className="font-medium mb-2">{review.title}</h4>
            )}

            {review.review_text && (
                <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                    {review.review_text}
                </p>
            )}

            {/* Review Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => onHelpfulVote(review.id, true)}
                        className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
                    >
                        <HandThumbUpIcon className="w-4 h-4" />
                        <span>Helpful ({review.helpful_count})</span>
                    </button>

                    <button
                        onClick={() => onHelpfulVote(review.id, false)}
                        className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
                    >
                        <HandThumbDownIcon className="w-4 h-4" />
                        <span>Not Helpful</span>
                    </button>
                </div>
            </div>

            {/* Report Form */}
            {showReportForm && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-medium mb-3">Report this review</h5>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Reason</label>
                            <select
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                            >
                                <option value="">Select a reason</option>
                                <option value="spam">Spam</option>
                                <option value="inappropriate">Inappropriate content</option>
                                <option value="fake">Fake review</option>
                                <option value="offensive">Offensive language</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                                rows="3"
                                placeholder="Provide additional details..."
                            />
                        </div>

                        <div className="flex space-x-2">
                            <button
                                onClick={handleReport}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                                Submit Report
                            </button>
                            <button
                                onClick={() => setShowReportForm(false)}
                                className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductReviews;