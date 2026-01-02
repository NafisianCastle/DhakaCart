import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import {
    ClockIcon,
    CheckCircleIcon,
    TruckIcon,
    XCircleIcon,
    CogIcon
} from '@heroicons/react/24/outline';

const OrderStatusTracker = ({ orderId, currentStatus, className = '' }) => {
    const { subscribeToOrders, isConnected, notifications } = useWebSocket();
    const [realtimeStatus, setRealtimeStatus] = useState(currentStatus);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Subscribe to order updates
    useEffect(() => {
        if (isConnected) {
            subscribeToOrders();
        }
    }, [isConnected, subscribeToOrders]);

    // Listen for order status updates
    useEffect(() => {
        const orderNotifications = notifications.filter(
            notification => notification.orderId === orderId
        );

        if (orderNotifications.length > 0) {
            const latestNotification = orderNotifications[orderNotifications.length - 1];
            // Extract status from notification message if needed
            setLastUpdate(latestNotification.timestamp);
        }
    }, [notifications, orderId]);

    const statusSteps = [
        { key: 'pending', label: 'Order Placed', icon: ClockIcon },
        { key: 'confirmed', label: 'Confirmed', icon: CheckCircleIcon },
        { key: 'processing', label: 'Processing', icon: CogIcon },
        { key: 'shipped', label: 'Shipped', icon: TruckIcon },
        { key: 'delivered', label: 'Delivered', icon: CheckCircleIcon }
    ];

    const getCurrentStepIndex = () => {
        const status = realtimeStatus || currentStatus;
        if (status === 'cancelled') return -1;
        return statusSteps.findIndex(step => step.key === status);
    };

    const getStepStatus = (stepIndex) => {
        const currentIndex = getCurrentStepIndex();
        const status = realtimeStatus || currentStatus;

        if (status === 'cancelled') {
            return 'cancelled';
        } else if (stepIndex < currentIndex) {
            return 'completed';
        } else if (stepIndex === currentIndex) {
            return 'current';
        } else {
            return 'pending';
        }
    };

    const getStepStyles = (stepStatus) => {
        switch (stepStatus) {
            case 'completed':
                return {
                    circle: 'bg-green-500 text-white border-green-500',
                    line: 'bg-green-500',
                    text: 'text-green-600'
                };
            case 'current':
                return {
                    circle: 'bg-blue-500 text-white border-blue-500 animate-pulse',
                    line: 'bg-gray-300',
                    text: 'text-blue-600 font-semibold'
                };
            case 'cancelled':
                return {
                    circle: 'bg-red-500 text-white border-red-500',
                    line: 'bg-red-300',
                    text: 'text-red-600'
                };
            default:
                return {
                    circle: 'bg-gray-200 text-gray-400 border-gray-300',
                    line: 'bg-gray-300',
                    text: 'text-gray-500'
                };
        }
    };

    const displayStatus = realtimeStatus || currentStatus;

    return (
        <div className={`${className}`}>
            {/* Real-time indicator */}
            {isConnected && lastUpdate && (
                <div className="flex items-center space-x-2 mb-4 p-2 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm text-blue-600">
                        Live tracking • Last updated {new Date(lastUpdate).toLocaleTimeString()}
                    </span>
                </div>
            )}

            {/* Cancelled status */}
            {displayStatus === 'cancelled' && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 font-medium">Order Cancelled</span>
                </div>
            )}

            {/* Status tracker */}
            <div className="relative">
                {statusSteps.map((step, index) => {
                    const stepStatus = getStepStatus(index);
                    const styles = getStepStyles(stepStatus);
                    const Icon = step.icon;
                    const isLast = index === statusSteps.length - 1;

                    return (
                        <div key={step.key} className="relative flex items-center">
                            {/* Step circle */}
                            <div className={`
                relative z-10 flex items-center justify-center
                w-8 h-8 rounded-full border-2 transition-all duration-300
                ${styles.circle}
              `}>
                                <Icon className="h-4 w-4" />
                            </div>

                            {/* Step label */}
                            <div className="ml-4 flex-1">
                                <p className={`text-sm transition-colors duration-300 ${styles.text}`}>
                                    {step.label}
                                </p>
                            </div>

                            {/* Connecting line */}
                            {!isLast && (
                                <div className={`
                  absolute left-4 top-8 w-0.5 h-8 transition-colors duration-300
                  ${styles.line}
                `} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status summary */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Current Status:</span>
                    <span className="text-sm font-medium capitalize">
                        {displayStatus.replace('_', ' ')}
                    </span>
                </div>

                {lastUpdate && (
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">Last Updated:</span>
                        <span className="text-xs text-gray-500">
                            {new Date(lastUpdate).toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderStatusTracker;