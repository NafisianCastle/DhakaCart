import React, { useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import {
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

const InventoryStatus = ({ productId, currentStock, threshold = 10, className = '' }) => {
    const { getInventoryUpdate, subscribeToInventory, isConnected } = useWebSocket();

    // Subscribe to inventory updates for this product
    useEffect(() => {
        if (isConnected && productId) {
            subscribeToInventory([productId]);
        }
    }, [isConnected, productId, subscribeToInventory]);

    // Get real-time inventory update
    const inventoryUpdate = getInventoryUpdate(productId);

    // Use real-time stock if available, otherwise use current stock
    const displayStock = inventoryUpdate ? inventoryUpdate.stockQuantity : currentStock;
    const isLowStock = displayStock <= threshold;
    const isOutOfStock = displayStock === 0;

    const getStatusIcon = () => {
        if (isOutOfStock) {
            return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
        } else if (isLowStock) {
            return <ClockIcon className="h-4 w-4 text-yellow-500" />;
        } else {
            return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
        }
    };

    const getStatusText = () => {
        if (isOutOfStock) {
            return 'Out of Stock';
        } else if (isLowStock) {
            return `Low Stock (${displayStock} left)`;
        } else {
            return `In Stock (${displayStock} available)`;
        }
    };

    const getStatusStyles = () => {
        if (isOutOfStock) {
            return 'text-red-600 bg-red-50 border-red-200';
        } else if (isLowStock) {
            return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        } else {
            return 'text-green-600 bg-green-50 border-green-200';
        }
    };

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            {/* Real-time indicator */}
            {isConnected && inventoryUpdate && (
                <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-600">Live</span>
                </div>
            )}

            {/* Status badge */}
            <div className={`
        flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium
        ${getStatusStyles()}
      `}>
                {getStatusIcon()}
                <span>{getStatusText()}</span>
            </div>

            {/* Last updated timestamp for real-time updates */}
            {inventoryUpdate && (
                <span className="text-xs text-gray-500">
                    Updated {new Date(inventoryUpdate.timestamp).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
};

export default InventoryStatus;