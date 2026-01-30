import React, { useMemo } from 'react';
import { marked } from 'marked';
import CodeBlock from './CodeBlock';
import { FileText } from 'lucide-react';

// Configure marked options
marked.use({ breaks: true });

const MessageBubble = React.forwardRef(({ role, text, attachment, time, sender, onReviewCode, onApplyCode, onViewAttachment }, ref) => {

    const contentParts = useMemo(() => {
        const parts = [];
        const startTag = "<abap>";
        const endTag = "</abap>";

        if (!text) return [];

        let cursor = 0;
        while (cursor < text.length) {
            const start = text.indexOf(startTag, cursor);
            if (start === -1) {
                const rest = text.slice(cursor);
                if (rest) parts.push({ type: 'text', content: rest });
                break;
            }

            if (start > cursor) {
                parts.push({ type: 'text', content: text.slice(cursor, start) });
            }

            const end = text.indexOf(endTag, start + startTag.length);
            if (end === -1) {
                // No closing tag, treat rest as text
                parts.push({ type: 'text', content: text.slice(start) });
                break;
            }

            const code = text.slice(start + startTag.length, end);
            parts.push({ type: 'code', content: code });
            cursor = end + endTag.length;
        }
        return parts;
    }, [text]);

    return (
        <div ref={ref} className={`message ${role} ${contentParts.some(p => p.type === 'code') ? 'has-code' : ''}`}>
            <div className="message-meta">
                <span>{sender}</span><span>{time}</span>
            </div>
            <div>
                {contentParts.map((part, idx) => {
                    if (part.type === 'code') {
                        // Get context from previous part if it exists and is text
                        const prevPart = idx > 0 ? contentParts[idx - 1] : null;
                        const context = (prevPart && prevPart.type === 'text') ? prevPart.content : '';

                        return (
                            <CodeBlock
                                key={idx}
                                code={part.content}
                                context={context}
                                onReview={onReviewCode}
                                onApply={onApplyCode}
                            />
                        );
                    } else {
                        return (
                            <div
                                key={idx}
                                dangerouslySetInnerHTML={{ __html: marked.parse(part.content) }}
                            />
                        );
                    }
                })}

                {/* Attachment Card */}
                {attachment && (
                    <div
                        className="attachment-card"
                        onDoubleClick={() => onViewAttachment && onViewAttachment(attachment)}
                        title="Double-click to view content"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginTop: '10px',
                            padding: '10px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            maxWidth: '300px'
                        }}
                    >
                        <FileText size={20} style={{ marginRight: '10px', opacity: 0.8 }} />
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {attachment.name}
                            </div>
                            <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                                Double-click to view
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default MessageBubble;
