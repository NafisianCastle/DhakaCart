import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import logger from './logger';

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

function App() {
  const [user, setUser] = useState(null);
  const [cartItemCount, setCartItemCount] = useState(0);

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
        setUser(parsedUser);
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

  const handleLogin = (userData) => {
    setUser(userData);
    logger.info('User logged in', { userId: userData.id });
  };

  const handleRegister = (userData) => {
    setUser(userData);
    logger.info('User registered', { userId: userData.id });
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
      </div>
    </Router>
  );
}

export default App;