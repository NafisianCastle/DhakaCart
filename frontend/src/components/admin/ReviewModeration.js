import React, { useState, useEffect } from 'react';
import {
    StarIcon,
    EyeIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    UserCircleIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const ReviewModeration = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        status: 'pending',
        rating: '',
        search: '',
        sortBy: 'created_at',
        sortOrder: 'DESC'
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });
    const [selectedReviews, setSelectedReviews] = useState(new Set());
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [filters, pagination.page]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('authToken');

            const queryParams = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                ...(filters.status && { status: filters.status }),
                ...(filters.rating && { rating: filters.rating }),
                ...(filters.search && { search: filters.search })
            });

            const response = await fetch(`/api/admin/reviews?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

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

    const handleReviewAction = async (reviewId, action, reason = null) => {
        try {
            setActionLoading(true);
            const token = localStorage.getItem('authToken');

            const response = await fetch(`/api/admin/reviews/${reviewId}/moderate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action, reason })
            });

            const data = await response.json();

            if (data.success) {
                // Remove the review from the list or update its status
                setReviews(prev => prev.filter(review => review.id !== reviewId));
                setSelectedReviews(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(reviewId);
                    return newSet;
                });
            } else {
                alert(data.error || 'Failed to moderate review');
            }
        } catch (err) {
            alert('Failed to moderate review');
        } finally {
            setActionLoading(false);
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedReviews.size === 0) {
            alert('Please select reviews to moderate');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to ${action} ${selectedReviews.size} review(s)?`
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            const token = localStorage.getItem('authToken');

            const response = await fetch('/api/admin/reviews/bulk-moderate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reviewIds: Array.from(selectedReviews),
                    action
                })
            });

            const data = await response.json();

            if (data.success) {
                // Remove moderated reviews from the list
                setReviews(prev => prev.filter(review => !selectedReviews.has(review.id)));
                setSelectedReviews(new Set());
            } else {
                alert(data.error || 'Failed to moderate reviews');
            }
        } catch (err) {
            alert('Failed to moderate reviews');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSelectReview = (reviewId) => {
        setSelectedReviews(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reviewId)) {
                newSet.delete(reviewId);
            } else {
                newSet.add(reviewId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedReviews.size === reviews.length) {
            setSelectedReviews(new Set());
        } else {
            setSelectedReviews(new Set(reviews.map(review => review.id)));
        }
    };

    const renderStars = (rating) => {
        return (
            <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                    <StarIconSolid
                        key={star}
                        className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    />
                ))}
            </div>
        );
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
            approved: { color: 'bg-green-100 text-green-800', text: 'Approved' },
            rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' },
            flagged: { color: 'bg-orange-100 text-orange-800', text: 'Flagged' }
        };

        const config = statusConfig[status] || statusConfig.pending;

        return (
            <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
                {config.text}
            </span>
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
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Review Moderation</h2>

                {selectedReviews.size > 0 && (
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                            {selectedReviews.size} selected
                        </span>
                        <button
                            onClick={() => handleBulkAction('approve')}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                            Approve
                        </button>
                        <button
                            onClick={() => handleBulkAction('reject')}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                            Reject
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="flagged">Flagged</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Rating</label>
                        <select
                            value={filters.rating}
                            onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="">All Ratings</option>
                            <option value="5">5 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="3">3 Stars</option>
                            <option value="2">2 Stars</option>
                            <option value="1">1 Star</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Sort By</label>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="created_at">Date Created</option>
                            <option value="rating">Rating</option>
                            <option value="reports_count">Reports Count</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Search</label>
                        <div className="relative">
                            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full border rounded px-10 py-2"
                                placeholder="Search reviews..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reviews List */}
            <div className="bg-white rounded-lg border">
                {reviews.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <EyeIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No reviews found matching your criteria</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="border-b p-4">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={selectedReviews.size === reviews.length && reviews.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded"
                                />
                                <span className="text-sm font-medium">Select All</span>
                            </div>
                        </div>

                        {/* Review Items */}
                        <div className="divide-y">
                            {reviews.map((review) => (
                                <div key={review.id} className="p-4">
                                    <div className="flex items-start space-x-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedReviews.has(review.id)}
                                            onChange={() => handleSelectReview(review.id)}
                                            className="mt-1 rounded"
                                        />

                                        <div className="flex-1 space-y-3">
                                            {/* Review Header */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <UserCircleIcon className="w-8 h-8 text-gray-400" />
                                                    <div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-medium">
                                                                {review.user.firstName} {review.user.lastName}
                                                            </span>
                                                            {getStatusBadge(review.status)}
                                                            {review.is_verified_purchase && (
                                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
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

                                                <div className="flex items-center space-x-2">
                                                    {review.reports_count > 0 && (
                                                        <span className="flex items-center space-x-1 text-red-600 text-sm">
                                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                                            <span>{review.reports_count} reports</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Product Info */}
                                            <div className="text-sm text-gray-600">
                                                Product: <span className="font-medium">{review.product.name}</span>
                                            </div>

                                            {/* Review Content */}
                                            {review.title && (
                                                <h4 className="font-medium">{review.title}</h4>
                                            )}

                                            {review.review_text && (
                                                <p className="text-gray-700 whitespace-pre-wrap">
                                                    {review.review_text}
                                                </p>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center space-x-3 pt-2">
                                                <button
                                                    onClick={() => handleReviewAction(review.id, 'approve')}
                                                    disabled={actionLoading}
                                                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                    <span>Approve</span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        const reason = prompt('Reason for rejection (optional):');
                                                        if (reason !== null) {
                                                            handleReviewAction(review.id, 'reject', reason);
                                                        }
                                                    }}
                                                    disabled={actionLoading}
                                                    className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    <XCircleIcon className="w-4 h-4" />
                                                    <span>Reject</span>
                                                </button>

                                                {review.reports_count > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            // Show reports details (could be a modal)
                                                            alert(`This review has ${review.reports_count} reports`);
                                                        }}
                                                        className="flex items-center space-x-1 px-3 py-1 border border-orange-600 text-orange-600 rounded text-sm hover:bg-orange-50"
                                                    >
                                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                                        <span>View Reports</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2">
                    <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="px-3 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Previous
                    </button>

                    <span className="px-4 py-2 text-sm text-gray-600">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
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

export default ReviewModeration;