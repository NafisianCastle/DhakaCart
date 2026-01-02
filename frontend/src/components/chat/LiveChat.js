import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import {
    ChatBubbleLeftRightIcon,
    PaperAirplaneIcon,
    XMarkIcon,
    UserIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';

const LiveChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const {
        isConnected,
        chatMessages,
        sendChatMessage,
        sendAdminResponse,
        clearChatMessages
    } = useWebSocket();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!message.trim() || !isConnected) return;

        sendChatMessage(message.trim());
        setMessage('');
        setIsTyping(false);
    };

    const handleInputChange = (e) => {
        setMessage(e.target.value);
        setIsTyping(e.target.value.length > 0);
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            // Clear typing indicator when opening
            setIsTyping(false);
        }
    };

    const getMessageAlignment = (messageType) => {
        switch (messageType) {
            case 'sent':
                return 'justify-end';
            case 'received':
            case 'admin_response':
                return 'justify-start';
            default:
                return 'justify-start';
        }
    };

    const getMessageStyles = (messageType) => {
        switch (messageType) {
            case 'sent':
                return 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg';
            case 'received':
            case 'admin_response':
                return 'bg-gray-200 text-gray-800 rounded-r-lg rounded-tl-lg';
            default:
                return 'bg-gray-100 text-gray-700 rounded-lg';
        }
    };

    const getMessageIcon = (messageType) => {
        switch (messageType) {
            case 'sent':
                return <UserIcon className="h-4 w-4" />;
            case 'received':
            case 'admin_response':
                return <UserCircleIcon className="h-4 w-4" />;
            default:
                return <UserIcon className="h-4 w-4" />;
        }
    };

    const formatMessageTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={toggleChat}
                className={`
          fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${isConnected
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }
          ${isOpen ? 'rotate-180' : ''}
        `}
                disabled={!isConnected}
                title={isConnected ? 'Open Live Chat' : 'Chat unavailable - not connected'}
            >
                {isOpen ? (
                    <XMarkIcon className="h-6 w-6" />
                ) : (
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                )}

                {/* Unread messages indicator */}
                {!isOpen && chatMessages.some(msg => msg.type === 'received') && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                            {chatMessages.filter(msg => msg.type === 'received').length}
                        </span>
                    </div>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-30 w-80 h-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
                    {/* Chat Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-500 text-white rounded-t-lg">
                        <div className="flex items-center space-x-2">
                            <ChatBubbleLeftRightIcon className="h-5 w-5" />
                            <h3 className="font-semibold">Live Support</h3>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Connection Status */}
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />

                            {/* Clear Chat Button */}
                            <button
                                onClick={clearChatMessages}
                                className="text-white hover:text-gray-200 transition-colors"
                                title="Clear chat"
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                <p>Start a conversation with our support team</p>
                            </div>
                        ) : (
                            chatMessages.map((msg, index) => (
                                <div key={msg.id || index} className={`flex ${getMessageAlignment(msg.type)}`}>
                                    <div className="max-w-xs">
                                        <div className={`px-3 py-2 ${getMessageStyles(msg.type)}`}>
                                            <p className="text-sm">{msg.message}</p>
                                        </div>

                                        <div className={`flex items-center mt-1 text-xs text-gray-500 ${msg.type === 'sent' ? 'justify-end' : 'justify-start'
                                            }`}>
                                            {getMessageIcon(msg.type)}
                                            <span className="ml-1">
                                                {msg.adminEmail || msg.userEmail || 'You'} • {formatMessageTime(msg.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Typing Indicator */}
                        {isTyping && (
                            <div className="flex justify-end">
                                <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-l-lg rounded-tr-lg text-sm">
                                    <span className="italic">Typing...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                        <div className="flex space-x-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={message}
                                onChange={handleInputChange}
                                placeholder={isConnected ? "Type your message..." : "Connecting..."}
                                disabled={!isConnected}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                maxLength={500}
                            />

                            <button
                                type="submit"
                                disabled={!message.trim() || !isConnected}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <PaperAirplaneIcon className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Character Counter */}
                        <div className="text-xs text-gray-500 mt-1 text-right">
                            {message.length}/500
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default LiveChat;