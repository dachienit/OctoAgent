import React, { useState, useRef, useEffect } from 'react';
import { User } from 'lucide-react';

export default function UserProfile({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [containerRef]);

    if (!user) return null;

    const displayName = user.firstName || user.username || "User";
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <div className="user-profile-container" ref={containerRef}>
            <div
                className="user-avatar"
                onClick={() => setIsOpen(!isOpen)}
                title={displayName}
            >
                {/* Display Full First Name as requested */}
                {displayName}
            </div>

            {isOpen && (
                <div className="user-details-popover">
                    <div className="popover-header">
                        <strong>User Profile</strong>
                    </div>
                    <div className="popover-content">
                        <div className="detail-row">
                            <span className="label">Full Name:</span>
                            <span className="value">
                                {user.firstName} {user.lastName}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="label">User ID:</span>
                            <span className="value">{user.username}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Email:</span>
                            <span className="value">{user.email || "N/A"}</span>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
