import { useEffect } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

const useWebSocketConnection = (user) => {
    const { connect, disconnect, isConnected } = useWebSocket();

    useEffect(() => {
        // Connect when user is logged in and has a token
        if (user && user.token) {
            connect(user.token);
        } else {
            // Disconnect when user logs out
            disconnect();
        }

        // Cleanup on unmount
        return () => {
            disconnect();
        };
    }, [user, connect, disconnect]);

    return { isConnected };
};

export default useWebSocketConnection;