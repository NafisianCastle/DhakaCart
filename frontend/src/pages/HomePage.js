import React from 'react';
import HeroSection from '../components/home/HeroSection';
import FeaturedProducts from '../components/home/FeaturedProducts';
import CategoryShowcase from '../components/home/CategoryShowcase';

const HomePage = () => {
    const sectionStyle = {
        padding: '4rem 0',
        backgroundColor: '#f9fafb'
    };

    const containerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
    };

    const headerStyle = {
        textAlign: 'center',
        marginBottom: '3rem'
    };

    const titleStyle = {
        fontSize: '2.25rem',
        fontWeight: '800',
        color: '#111827',
        marginBottom: '1rem'
    };

    const subtitleStyle = {
        fontSize: '1.125rem',
        color: '#4b5563'
    };

    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '2rem'
    };

    const featureStyle = {
        textAlign: 'center'
    };

    const iconStyle = {
        width: '4rem',
        height: '4rem',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1rem',
        fontSize: '1.5rem'
    };

    const featureTitleStyle = {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '0.5rem'
    };

    const featureDescStyle = {
        fontSize: '1rem',
        color: '#6b7280'
    };

    const newsletterStyle = {
        padding: '4rem 0',
        background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
        color: 'white'
    };

    const newsletterHeaderStyle = {
        textAlign: 'center',
        marginBottom: '2rem'
    };

    const newsletterTitleStyle = {
        fontSize: '2.25rem',
        fontWeight: '800',
        marginBottom: '1rem'
    };

    const newsletterSubtitleStyle = {
        fontSize: '1.125rem',
        color: '#dbeafe'
    };

    const formStyle = {
        display: 'flex',
        justifyContent: 'center',
        maxWidth: '28rem',
        margin: '0 auto'
    };

    const inputStyle = {
        flex: 1,
        padding: '0.75rem 1rem',
        border: 'none',
        borderRadius: '0.375rem 0 0 0.375rem',
        fontSize: '1rem'
    };

    const buttonStyle = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#1e40af',
        color: 'white',
        border: 'none',
        borderRadius: '0 0.375rem 0.375rem 0',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer'
    };

    return (
        <div style={{ minHeight: '100vh' }}>
            <HeroSection />
            <FeaturedProducts />
            <CategoryShowcase />

            {/* Why Choose DhakaCart */}
            <section style={sectionStyle}>
                <div style={containerStyle}>
                    <div style={headerStyle}>
                        <h2 style={titleStyle}>Why Choose DhakaCart?</h2>
                        <p style={subtitleStyle}>
                            We're committed to providing the best shopping experience
                        </p>
                    </div>

                    <div style={gridStyle}>
                        <div style={featureStyle}>
                            <div style={{ ...iconStyle, backgroundColor: '#3b82f6', color: 'white' }}>
                                🚚
                            </div>
                            <h3 style={featureTitleStyle}>Fast Delivery</h3>
                            <p style={featureDescStyle}>
                                Free shipping on orders over $50. Same-day delivery available in select areas.
                            </p>
                        </div>

                        <div style={featureStyle}>
                            <div style={{ ...iconStyle, backgroundColor: '#10b981', color: 'white' }}>
                                🔒
                            </div>
                            <h3 style={featureTitleStyle}>Secure Payment</h3>
                            <p style={featureDescStyle}>
                                Your payment information is encrypted and secure with industry-standard protection.
                            </p>
                        </div>

                        <div style={featureStyle}>
                            <div style={{ ...iconStyle, backgroundColor: '#8b5cf6', color: 'white' }}>
                                ↩️
                            </div>
                            <h3 style={featureTitleStyle}>Easy Returns</h3>
                            <p style={featureDescStyle}>
                                30-day return policy. No questions asked if you're not completely satisfied.
                            </p>
                        </div>

                        <div style={featureStyle}>
                            <div style={{ ...iconStyle, backgroundColor: '#f97316', color: 'white' }}>
                                🎧
                            </div>
                            <h3 style={featureTitleStyle}>24/7 Support</h3>
                            <p style={featureDescStyle}>
                                Our customer service team is available around the clock to help you.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Newsletter Signup */}
            <section style={newsletterStyle}>
                <div style={containerStyle}>
                    <div style={newsletterHeaderStyle}>
                        <h2 style={newsletterTitleStyle}>Stay Updated</h2>
                        <p style={newsletterSubtitleStyle}>
                            Subscribe to our newsletter for exclusive deals and new product announcements
                        </p>
                    </div>
                    <div style={formStyle}>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            style={inputStyle}
                        />
                        <button style={buttonStyle}>
                            Subscribe
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;