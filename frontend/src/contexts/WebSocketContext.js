import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext();

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [inventoryUpdates, setInventoryUpdates] = useState({});

    // Initialize WebSocket connection
    const connect = useCallback((token) => {
        if (socket) {
            socket.disconnect();
        }

        const newSocket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling'],
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('WebSocket connected:', newSocket.id);
            setIsConnected(true);
            setConnectionError(null);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            setConnectionError(error.message);
            setIsConnected(false);
        });

        // Welcome message
        newSocket.on('connected', (data) => {
            console.log('WebSocket welcome:', data);
            addNotification({
                type: 'success',
                message: 'Connected to real-time updates',
                timestamp: new Date().toISOString()
            });
        });

        // Inventory updates
        newSocket.on('inventory:updated', (data) => {
            console.log('Inventory update received:', data);
            setInventoryUpdates(prev => ({
                ...prev,
                [data.productId]: data
            }));

            if (data.lowStock) {
                addNotification({
                    type: 'warning',
                    message: `Low stock alert: Product ${data.productId} has ${data.stockQuantity} items remaining`,
                    timestamp: data.timestamp
                });
            }
        });

        newSocket.on('inventory:low_stock', (data) => {
            console.log('Low stock alert:', data);
            addNotification({
                type: 'error',
                message: data.message,
                timestamp: data.timestamp
            });
        });

        // Order updates
        newSocket.on('order:status_updated', (data) => {
            console.log('Order status update:', data);
            addNotification({
                type: 'info',
                message: `Order #${data.orderId}: ${data.message}`,
                timestamp: data.timestamp,
                orderId: data.orderId
            });
        });

        newSocket.on('order:new_order', (data) => {
            console.log('New order notification:', data);
            addNotification({
                type: 'info',
                message: `New order #${data.orderId} from ${data.userEmail}`,
                timestamp: data.timestamp,
                orderId: data.orderId
            });
        });

        // Chat messages
        newSocket.on('chat:message:sent', (data) => {
            console.log('Chat message sent:', data);
            setChatMessages(prev => [...prev, { ...data, type: 'sent' }]);
        });

        newSocket.on('chat:admin_response', (data) => {
            console.log('Admin response received:', data);
            setChatMessages(prev => [...prev, { ...data, type: 'received' }]);
            addNotification({
                type: 'info',
                message: 'You have a new message from support',
                timestamp: data.timestamp
            });
        });

        newSocket.on('chat:new_message', (data) => {
            console.log('New chat message for admin:', data);
            setChatMessages(prev => [...prev, { ...data, type: 'customer' }]);
            addNotification({
                type: 'info',
                message: `New message from ${data.userEmail}`,
                timestamp: data.timestamp
            });
        });

        newSocket.on('chat:response:sent', (data) => {
            console.log('Admin response sent:', data);
            setChatMessages(prev => [...prev, { ...data, type: 'admin_sent' }]);
        });

        // System notifications
        newSocket.on('system:notification', (data) => {
            console.log('System notification:', data);
            addNotification({
                type: data.type,
                message: data.message,
                timestamp: data.timestamp
            });
        });

        // Error handling
        newSocket.on('error', (error) => {
            console.error('WebSocket error:', error);
            addNotification({
                type: 'error',
                message: error.message || 'WebSocket error occurred',
                timestamp: new Date().toISOString()
            });
        });

        setSocket(newSocket);
        return newSocket;
    }, [socket]);

    // Disconnect WebSocket
    const disconnect = useCallback(() => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
            setConnectionError(null);
        }
    }, [socket]);

    // Add notification helper
    const addNotification = useCallback((notification) => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { ...notification, id }]);

        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    // Remove notification
    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Subscribe to inventory updates for specific products
    const subscribeToInventory = useCallback((productIds) => {
        if (socket && isConnected) {
            socket.emit('subscribe:inventory', productIds);
        }
    }, [socket, isConnected]);

    // Subscribe to order updates
    const subscribeToOrders = useCallback(() => {
        if (socket && isConnected) {
            socket.emit('subscribe:orders');
        }
    }, [socket, isConnected]);

    // Send chat message
    const sendChatMessage = useCallback((message, type = 'customer_support') => {
        if (socket && isConnected) {
            socket.emit('chat:message', { message, type });
        }
    }, [socket, isConnected]);

    // Send admin chat response
    const sendAdminResponse = useCallback((userId, message, originalMessageId) => {
        if (socket && isConnected) {
            socket.emit('admin:chat:response', { userId, message, originalMessageId });
        }
    }, [socket, isConnected]);

    // Clear chat messages
    const clearChatMessages = useCallback(() => {
        setChatMessages([]);
    }, []);

    // Get inventory update for specific product
    const getInventoryUpdate = useCallback((productId) => {
        return inventoryUpdates[productId] || null;
    }, [inventoryUpdates]);

    // Clear inventory updates
    const clearInventoryUpdates = useCallback(() => {
        setInventoryUpdates({});
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);

    const value = {
        // Connection state
        socket,
        isConnected,
        connectionError,

        // Connection methods
        connect,
        disconnect,

        // Notifications
        notifications,
        addNotification,
        removeNotification,

        // Chat
        chatMessages,
        sendChatMessage,
        sendAdminResponse,
        clearChatMessages,

        // Inventory
        inventoryUpdates,
        getInventoryUpdate,
        subscribeToInventory,
        clearInventoryUpdates,

        // Orders
        subscribeToOrders
    };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export default WebSocketContext;