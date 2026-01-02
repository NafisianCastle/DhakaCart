import React from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XCircleIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

const NotificationCenter = () => {
    const { notifications, removeNotification } = useWebSocket();

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'warning':
                return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
            case 'error':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            case 'info':
            default:
                return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
        }
    };

    const getNotificationStyles = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`
            flex items-start p-4 rounded-lg border shadow-lg
            transform transition-all duration-300 ease-in-out
            ${getNotificationStyles(notification.type)}
          `}
                >
                    <div className="flex-shrink-0 mr-3">
                        {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                            {notification.message}
                        </p>
                        {notification.timestamp && (
                            <p className="text-xs opacity-75 mt-1">
                                {new Date(notification.timestamp).toLocaleTimeString()}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => removeNotification(notification.id)}
                        className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationCenter;