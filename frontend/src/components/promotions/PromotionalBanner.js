import React, { useState, useEffect } from 'react';
import './PromotionalBanner.css';

const PromotionalBanner = ({ position = 'hero' }) => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPromotionalBanners();
    }, [position]);

    const fetchPromotionalBanners = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/promotions/banners?position=${position}`);

            if (!response.ok) {
                throw new Error('Failed to fetch promotional banners');
            }

            const data = await response.json();
            setBanners(data.banners || []);
        } catch (err) {
            console.error('Error fetching promotional banners:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={`promotional-banner promotional-banner--${position} promotional-banner--loading`}>
                <div className="promotional-banner__skeleton">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-subtitle"></div>
                    <div className="skeleton-button"></div>
                </div>
            </div>
        );
    }

    if (error || banners.length === 0) {
        return null; // Don't show anything if there's an error or no banners
    }

    // Show the first banner (highest priority)
    const banner = banners[0];

    const handleBannerClick = () => {
        if (banner.link_url) {
            window.location.href = banner.link_url;
        }
    };

    return (
        <div className={`promotional-banner promotional-banner--${position}`}>
            <div className="promotional-banner__content">
                {banner.image_url && (
                    <div className="promotional-banner__image">
                        <img
                            src={banner.image_url}
                            alt={banner.title}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </div>
                )}

                <div className="promotional-banner__text">
                    <h2 className="promotional-banner__title">{banner.title}</h2>

                    {banner.subtitle && (
                        <h3 className="promotional-banner__subtitle">{banner.subtitle}</h3>
                    )}

                    {banner.description && (
                        <p className="promotional-banner__description">{banner.description}</p>
                    )}

                    {banner.button_text && banner.link_url && (
                        <button
                            className="promotional-banner__button"
                            onClick={handleBannerClick}
                        >
                            {banner.button_text}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PromotionalBanner;