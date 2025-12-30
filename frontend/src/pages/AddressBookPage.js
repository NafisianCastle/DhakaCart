import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api';
import logger from '../logger';

const AddressBookPage = () => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        company: '',
        address: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
        phone: '',
        isDefault: false
    });
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }

            setLoading(true);
            setError(null);

            // Load addresses from localStorage (in a real app, this would be from the backend)
            const addressData = localStorage.getItem('addresses');
            if (addressData) {
                const savedAddresses = JSON.parse(addressData);
                setAddresses(savedAddresses);
                logger.info('Addresses loaded', { addressCount: savedAddresses.length });
            } else {
                // Initialize with a default address if none exist
                const defaultAddress = {
                    id: '1',
                    firstName: 'John',
                    lastName: 'Doe',
                    address: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    zipCode: '10001',
                    country: 'United States',
                    phone: '+1 (555) 123-4567',
                    isDefault: true
                };
                setAddresses([defaultAddress]);
                localStorage.setItem('addresses', JSON.stringify([defaultAddress]));
            }

        } catch (err) {
            const errorMessage = 'Failed to load addresses';
            setError(errorMessage);
            logger.error(errorMessage, { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.firstName.trim()) errors.firstName = 'First name is required';
        if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
        if (!formData.address.trim()) errors.address = 'Address is required';
        if (!formData.city.trim()) errors.city = 'City is required';
        if (!formData.state.trim()) errors.state = 'State is required';
        if (!formData.zipCode.trim()) errors.zipCode = 'ZIP code is required';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            let updatedAddresses;

            if (editingAddress) {
                // Update existing address
                updatedAddresses = addresses.map(addr =>
                    addr.id === editingAddress.id
                        ? { ...formData, id: editingAddress.id }
                        : addr
                );
                logger.info('Address updated', { addressId: editingAddress.id });
            } else {
                // Add new address
                const newAddress = {
                    ...formData,
                    id: Date.now().toString()
                };
                updatedAddresses = [...addresses, newAddress];
                logger.info('New address added', { addressId: newAddress.id });
            }

            // If this address is set as default, remove default from others
            if (formData.isDefault) {
                updatedAddresses = updatedAddresses.map(addr => ({
                    ...addr,
                    isDefault: addr.id === (editingAddress?.id || updatedAddresses[updatedAddresses.length - 1].id)
                }));
            }

            setAddresses(updatedAddresses);
            localStorage.setItem('addresses', JSON.stringify(updatedAddresses));

            // Reset form
            setShowForm(false);
            setEditingAddress(null);
            setFormData({
                firstName: '',
                lastName: '',
                company: '',
                address: '',
                address2: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'United States',
                phone: '',
                isDefault: false
            });

        } catch (err) {
            logger.error('Failed to save address', { error: err.message });
            alert('Failed to save address. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (address) => {
        setEditingAddress(address);
        setFormData({ ...address });
        setShowForm(true);
    };

    const handleDelete = (addressId) => {
        if (window.confirm('Are you sure you want to delete this address?')) {
            const updatedAddresses = addresses.filter(addr => addr.id !== addressId);

            // If we deleted the default address, make the first remaining address default
            if (updatedAddresses.length > 0 && !updatedAddresses.some(addr => addr.isDefault)) {
                updatedAddresses[0].isDefault = true;
            }

            setAddresses(updatedAddresses);
            localStorage.setItem('addresses', JSON.stringify(updatedAddresses));
            logger.info('Address deleted', { addressId });
        }
    };

    const handleSetDefault = (addressId) => {
        const updatedAddresses = addresses.map(addr => ({
            ...addr,
            isDefault: addr.id === addressId
        }));
        setAddresses(updatedAddresses);
        localStorage.setItem('addresses', JSON.stringify(updatedAddresses));
        logger.info('Default address updated', { addressId });
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingAddress(null);
        setFormData({
            firstName: '',
            lastName: '',
            company: '',
            address: '',
            address2: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'United States',
            phone: '',
            isDefault: false
        });
        setFormErrors({});
    };

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '2rem 0'
    };

    const innerContainerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
    };

    const headerStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const titleStyle = {
        fontSize: '2rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const subtitleStyle = {
        color: '#6b7280',
        fontSize: '1rem'
    };

    const actionsStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
    };

    const addButtonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const addressCardStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        position: 'relative'
    };

    const defaultBadgeStyle = {
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#059669',
        color: 'white',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600'
    };

    const addressNameStyle = {
        fontSize: '1.125rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const addressTextStyle = {
        color: '#6b7280',
        fontSize: '0.875rem',
        lineHeight: '1.5',
        marginBottom: '1rem'
    };

    const buttonGroupStyle = {
        display: 'flex',
        gap: '0.5rem'
    };

    const primaryButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const secondaryButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const dangerButtonStyle = {
        padding: '0.5rem 1rem',
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    const formStyle = {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    };

    const formTitleStyle = {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '1.5rem'
    };

    const formRowStyle = {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem'
    };

    const formGroupStyle = {
        flex: 1,
        marginBottom: '1rem'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.25rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '1rem',
        boxSizing: 'border-box'
    };

    const errorInputStyle = {
        ...inputStyle,
        borderColor: '#dc2626'
    };

    const errorTextStyle = {
        color: '#dc2626',
        fontSize: '0.75rem',
        marginTop: '0.25rem'
    };

    const checkboxStyle = {
        marginRight: '0.5rem'
    };

    const formActionsStyle = {
        display: 'flex',
        gap: '1rem',
        marginTop: '2rem'
    };

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2>Loading addresses...</h2>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={containerStyle}>
                <div style={innerContainerStyle}>
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2 style={{ color: '#dc2626' }}>{error}</h2>
                        <button onClick={loadAddresses} style={addButtonStyle}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={innerContainerStyle}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>Address Book</h1>
                    <p style={subtitleStyle}>
                        Manage your shipping and billing addresses
                    </p>
                </div>

                <div style={actionsStyle}>
                    <div style={{ color: '#6b7280', fontSize: '1rem' }}>
                        {addresses.length} address{addresses.length !== 1 ? 'es' : ''} saved
                    </div>
                    <button onClick={() => setShowForm(true)} style={addButtonStyle}>
                        Add New Address
                    </button>
                </div>

                {showForm && (
                    <div style={formStyle}>
                        <h2 style={formTitleStyle}>
                            {editingAddress ? 'Edit Address' : 'Add New Address'}
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <div style={formRowStyle}>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>First Name *</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        style={formErrors.firstName ? errorInputStyle : inputStyle}
                                    />
                                    {formErrors.firstName && <div style={errorTextStyle}>{formErrors.firstName}</div>}
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Last Name *</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        style={formErrors.lastName ? errorInputStyle : inputStyle}
                                    />
                                    {formErrors.lastName && <div style={errorTextStyle}>{formErrors.lastName}</div>}
                                </div>
                            </div>

                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Company (Optional)</label>
                                <input
                                    type="text"
                                    name="company"
                                    value={formData.company}
                                    onChange={handleInputChange}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Address *</label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    style={formErrors.address ? errorInputStyle : inputStyle}
                                />
                                {formErrors.address && <div style={errorTextStyle}>{formErrors.address}</div>}
                            </div>

                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Address Line 2 (Optional)</label>
                                <input
                                    type="text"
                                    name="address2"
                                    value={formData.address2}
                                    onChange={handleInputChange}
                                    style={inputStyle}
                                    placeholder="Apartment, suite, etc."
                                />
                            </div>

                            <div style={formRowStyle}>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>City *</label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        style={formErrors.city ? errorInputStyle : inputStyle}
                                    />
                                    {formErrors.city && <div style={errorTextStyle}>{formErrors.city}</div>}
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>State *</label>
                                    <input
                                        type="text"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        style={formErrors.state ? errorInputStyle : inputStyle}
                                    />
                                    {formErrors.state && <div style={errorTextStyle}>{formErrors.state}</div>}
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>ZIP Code *</label>
                                    <input
                                        type="text"
                                        name="zipCode"
                                        value={formData.zipCode}
                                        onChange={handleInputChange}
                                        style={formErrors.zipCode ? errorInputStyle : inputStyle}
                                    />
                                    {formErrors.zipCode && <div style={errorTextStyle}>{formErrors.zipCode}</div>}
                                </div>
                            </div>

                            <div style={formRowStyle}>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Country</label>
                                    <select
                                        name="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        style={inputStyle}
                                    >
                                        <option value="United States">United States</option>
                                        <option value="Canada">Canada</option>
                                        <option value="United Kingdom">United Kingdom</option>
                                        <option value="Australia">Australia</option>
                                    </select>
                                </div>

                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Phone (Optional)</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        name="isDefault"
                                        checked={formData.isDefault}
                                        onChange={handleInputChange}
                                        style={checkboxStyle}
                                    />
                                    Set as default address
                                </label>
                            </div>

                            <div style={formActionsStyle}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        ...primaryButtonStyle,
                                        backgroundColor: saving ? '#9ca3af' : '#2563eb',
                                        cursor: saving ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {saving ? 'Saving...' : (editingAddress ? 'Update Address' : 'Add Address')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    style={secondaryButtonStyle}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div>
                    {addresses.map((address) => (
                        <div key={address.id} style={addressCardStyle}>
                            {address.isDefault && (
                                <div style={defaultBadgeStyle}>Default</div>
                            )}

                            <div style={addressNameStyle}>
                                {address.firstName} {address.lastName}
                                {address.company && ` - ${address.company}`}
                            </div>

                            <div style={addressTextStyle}>
                                {address.address}
                                {address.address2 && <br />}
                                {address.address2}
                                <br />
                                {address.city}, {address.state} {address.zipCode}
                                <br />
                                {address.country}
                                {address.phone && (
                                    <>
                                        <br />
                                        {address.phone}
                                    </>
                                )}
                            </div>

                            <div style={buttonGroupStyle}>
                                <button
                                    onClick={() => handleEdit(address)}
                                    style={primaryButtonStyle}
                                >
                                    Edit
                                </button>
                                {!address.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(address.id)}
                                        style={secondaryButtonStyle}
                                    >
                                        Set as Default
                                    </button>
                                )}
                                {addresses.length > 1 && (
                                    <button
                                        onClick={() => handleDelete(address.id)}
                                        style={dangerButtonStyle}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <Link to="/account" style={secondaryButtonStyle}>
                        ← Back to Account
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AddressBookPage;