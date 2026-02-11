import React from 'react';

const LoadingBubble = () => {
    return (
        <div className="message bot">
            <div className="message-meta">
                <span>Octo Agent</span>
            </div>
            <div className="typing-indicator-container">
                <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span className="typing-text">Thinking...</span>
            </div>
        </div>
    );
};

export default LoadingBubble;
