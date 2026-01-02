import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import logger from './logger';

// WebSocket Context and Hooks
import { WebSocketProvider } from './contexts/WebSocketContext';
import useWebSocketConnection from './hooks/useWebSocketConnection';

// Real-time Components
import NotificationCenter from './components/notifications/NotificationCenter';
import LiveChat from './components/chat/LiveChat';

// Layout Components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import WishlistPage from './pages/WishlistPage';
import AddressBookPage from './pages/AddressBookPage';

// Admin Pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProductFormPage from './pages/AdminProductFormPage';

// Placeholder components for routes (to be implemented in later subtasks)
const AboutPage = () => <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h1 style={{ fontSize: '1.5rem' }}>About Page - Coming Soon</h1></div>;
const ContactPage = () => <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h1 style={{ fontSize: '1.5rem' }}>Contact Page - Coming Soon</h1></div>;

// Main App Content Component (inside WebSocket Provider)
function AppContent() {
  const [user, setUser] = useState(null);
  const [cartItemCount, setCartItemCount] = useState(0);

  // Initialize WebSocket connection based on user state
  useWebSocketConnection(user);

  useEffect(() => {
    logger.info('DhakaCart E-commerce App initialized', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    // Load user session from localStorage
    loadUserSession();

    // Load cart data from localStorage
    loadCartData();
  }, []);

  const loadUserSession = () => {
    try {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        // Include token in user object for WebSocket connection
        setUser({ ...parsedUser, token });
        logger.info('User session restored', { userId: parsedUser.id });
      }
    } catch (error) {
      logger.error('Failed to restore user session', { error: error.message });
      // Clear invalid data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  };

  const loadCartData = () => {
    try {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        const cart = JSON.parse(cartData);
        const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
        setCartItemCount(itemCount);
      }
    } catch (error) {
      logger.error('Failed to load cart data', { error: error.message });
    }
  };

  const handleLogin = (userData, token) => {
    // Include token for WebSocket connection
    const userWithToken = { ...userData, token };
    setUser(userWithToken);
    logger.info('User logged in', { userId: userData.id });
  };

  const handleRegister = (userData, token) => {
    // Include token for WebSocket connection
    const userWithToken = { ...userData, token };
    setUser(userWithToken);
    logger.info('User registered', { userId: userData.id });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    logger.info('User logged out');
  };

  const handleSearch = (query) => {
    logger.info('Search initiated', { query });
    // Redirect to products page with search parameter
    window.location.href = `/products?search=${encodeURIComponent(query)}`;
  };

  const updateCartCount = (count) => {
    setCartItemCount(count);
  };

  return (
    <Router>
      <div className="App" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header
          cartItemCount={cartItemCount}
          user={user}
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        <main style={{ flexGrow: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage updateCartCount={updateCartCount} />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/login"
              element={<LoginPage onLogin={handleLogin} />}
            />
            <Route
              path="/register"
              element={<RegisterPage onRegister={handleRegister} />}
            />
            <Route
              path="/cart"
              element={<CartPage updateCartCount={updateCartCount} />}
            />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/wishlist" element={<WishlistPage updateCartCount={updateCartCount} />} />
            <Route path="/addresses" element={<AddressBookPage />} />
            <Route path="/account" element={<AccountPage />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/products" element={<AdminProductsPage />} />
            <Route path="/admin/products/new" element={<AdminProductFormPage />} />
            <Route path="/admin/products/:id/edit" element={<AdminProductFormPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Routes>
        </main>

        <Footer />

        {/* Real-time Components */}
        <NotificationCenter />
        <LiveChat />
      </div>
    </Router>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}
}

export default App;