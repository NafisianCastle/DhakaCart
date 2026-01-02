const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../logger');

class WebSocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socket.id
        this.adminSockets = new Set(); // Set of admin socket IDs
        this.dbPool = null;
        this.redisPool = null;
    }

    initialize(server, dbPool, redisPool) {
        this.dbPool = dbPool;
        this.redisPool = redisPool;

        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await this.getUserById(decoded.userId);

                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.userId = user.id;
                socket.userRole = user.role;
                socket.userEmail = user.email;

                logger.info('WebSocket user authenticated', {
                    userId: user.id,
                    role: user.role,
                    socketId: socket.id
                });

                next();
            } catch (error) {
                logger.error('WebSocket authentication failed', {
                    error: error.message,
                    socketId: socket.id
                });
                next(new Error('Authentication failed'));
            }
        });

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        logger.info('WebSocket service initialized');
        return this.io;
    }

    async getUserById(userId) {
        try {
            const result = await this.dbPool.query(
                'SELECT id, email, role FROM users WHERE id = $1',
                [userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error fetching user for WebSocket auth', {
                userId,
                error: error.message
            });
            return null;
        }
    }

    handleConnection(socket) {
        const { userId, userRole, userEmail } = socket;

        // Store user connection
        this.connectedUsers.set(userId, socket.id);

        // Track admin connections
        if (userRole === 'admin') {
            this.adminSockets.add(socket.id);
        }

        // Join user to their personal room
        socket.join(`user:${userId}`);

        // Join admin users to admin room
        if (userRole === 'admin') {
            socket.join('admin');
        }

        logger.info('WebSocket connection established', {
            userId,
            userRole,
            socketId: socket.id,
            connectedUsers: this.connectedUsers.size
        });

        // Send welcome message
        socket.emit('connected', {
            message: 'Connected to DhakaCart real-time service',
            userId,
            timestamp: new Date().toISOString()
        });

        // Handle inventory subscription
        socket.on('subscribe:inventory', (productIds) => {
            this.handleInventorySubscription(socket, productIds);
        });

        // Handle chat messages
        socket.on('chat:message', (data) => {
            this.handleChatMessage(socket, data);
        });

        // Handle admin chat responses
        socket.on('admin:chat:response', (data) => {
            this.handleAdminChatResponse(socket, data);
        });

        // Handle order status subscription
        socket.on('subscribe:orders', () => {
            socket.join(`orders:${userId}`);
            logger.debug('User subscribed to order updates', { userId, socketId: socket.id });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            this.handleDisconnection(socket, reason);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error('WebSocket error', {
                userId,
                socketId: socket.id,
                error: error.message
            });
        });
    }

    handleInventorySubscription(socket, productIds) {
        if (!Array.isArray(productIds)) {
            socket.emit('error', { message: 'Product IDs must be an array' });
            return;
        }

        // Join rooms for each product
        productIds.forEach(productId => {
            socket.join(`inventory:${productId}`);
        });

        logger.debug('User subscribed to inventory updates', {
            userId: socket.userId,
            productIds,
            socketId: socket.id
        });

        socket.emit('inventory:subscribed', { productIds });
    }

    handleChatMessage(socket, data) {
        const { message, type = 'customer_support' } = data;

        if (!message || message.trim().length === 0) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
        }

        const chatMessage = {
            id: Date.now().toString(),
            userId: socket.userId,
            userEmail: socket.userEmail,
            message: message.trim(),
            type,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        // Send to user
        socket.emit('chat:message:sent', chatMessage);

        // Notify all admins
        this.io.to('admin').emit('chat:new_message', {
            ...chatMessage,
            socketId: socket.id
        });

        logger.info('Chat message sent', {
            userId: socket.userId,
            messageId: chatMessage.id,
            type,
            adminNotified: this.adminSockets.size > 0
        });
    }

    handleAdminChatResponse(socket, data) {
        if (socket.userRole !== 'admin') {
            socket.emit('error', { message: 'Unauthorized' });
            return;
        }

        const { userId, message, originalMessageId } = data;

        if (!message || message.trim().length === 0) {
            socket.emit('error', { message: 'Message cannot be empty' });
            return;
        }

        const response = {
            id: Date.now().toString(),
            adminId: socket.userId,
            adminEmail: socket.userEmail,
            message: message.trim(),
            originalMessageId,
            timestamp: new Date().toISOString(),
            type: 'admin_response'
        };

        // Send to specific user
        this.io.to(`user:${userId}`).emit('chat:admin_response', response);

        // Confirm to admin
        socket.emit('chat:response:sent', response);

        logger.info('Admin chat response sent', {
            adminId: socket.userId,
            targetUserId: userId,
            messageId: response.id,
            originalMessageId
        });
    }

    handleDisconnection(socket, reason) {
        const { userId, userRole } = socket;

        // Remove from connected users
        this.connectedUsers.delete(userId);

        // Remove from admin sockets if admin
        if (userRole === 'admin') {
            this.adminSockets.delete(socket.id);
        }

        logger.info('WebSocket disconnection', {
            userId,
            userRole,
            socketId: socket.id,
            reason,
            remainingConnections: this.connectedUsers.size
        });
    }

    // Public methods for other services to use

    async notifyInventoryUpdate(productId, stockQuantity, threshold = 10) {
        try {
            const notification = {
                productId,
                stockQuantity,
                timestamp: new Date().toISOString(),
                lowStock: stockQuantity <= threshold
            };

            // Notify users subscribed to this product
            this.io.to(`inventory:${productId}`).emit('inventory:updated', notification);

            // If low stock, notify admins
            if (stockQuantity <= threshold) {
                this.io.to('admin').emit('inventory:low_stock', {
                    ...notification,
                    message: `Low stock alert: Product ${productId} has ${stockQuantity} items remaining`
                });
            }

            logger.info('Inventory update notification sent', {
                productId,
                stockQuantity,
                lowStock: notification.lowStock,
                subscribedUsers: this.io.sockets.adapter.rooms.get(`inventory:${productId}`)?.size || 0
            });

            return true;
        } catch (error) {
            logger.error('Error sending inventory notification', {
                productId,
                error: error.message
            });
            return false;
        }
    }

    async notifyOrderUpdate(userId, orderData) {
        try {
            const notification = {
                orderId: orderData.id,
                status: orderData.status,
                totalAmount: orderData.total_amount,
                timestamp: new Date().toISOString(),
                message: this.getOrderStatusMessage(orderData.status)
            };

            // Notify specific user
            this.io.to(`user:${userId}`).emit('order:status_updated', notification);

            // Notify admins of new orders
            if (orderData.status === 'pending') {
                this.io.to('admin').emit('order:new_order', {
                    ...notification,
                    userId,
                    userEmail: orderData.user_email || 'Unknown'
                });
            }

            logger.info('Order update notification sent', {
                userId,
                orderId: orderData.id,
                status: orderData.status,
                adminNotified: orderData.status === 'pending'
            });

            return true;
        } catch (error) {
            logger.error('Error sending order notification', {
                userId,
                orderId: orderData.id,
                error: error.message
            });
            return false;
        }
    }

    getOrderStatusMessage(status) {
        const messages = {
            'pending': 'Your order has been received and is being processed',
            'confirmed': 'Your order has been confirmed',
            'processing': 'Your order is being prepared',
            'shipped': 'Your order has been shipped',
            'delivered': 'Your order has been delivered',
            'cancelled': 'Your order has been cancelled'
        };
        return messages[status] || 'Order status updated';
    }

    // Get connection statistics
    getStats() {
        return {
            connectedUsers: this.connectedUsers.size,
            adminConnections: this.adminSockets.size,
            totalRooms: this.io?.sockets.adapter.rooms.size || 0,
            timestamp: new Date().toISOString()
        };
    }

    // Broadcast system-wide notifications
    async broadcastSystemNotification(message, type = 'info') {
        try {
            const notification = {
                type,
                message,
                timestamp: new Date().toISOString()
            };

            this.io.emit('system:notification', notification);

            logger.info('System notification broadcasted', {
                type,
                message,
                connectedUsers: this.connectedUsers.size
            });

            return true;
        } catch (error) {
            logger.error('Error broadcasting system notification', {
                error: error.message
            });
            return false;
        }
    }
}

module.exports = WebSocketService;