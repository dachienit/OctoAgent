import React from 'react';
import './Modal.css'; // Reuse existing modal styles if compatible, or add inline

const FileViewerModal = ({ isOpen, onClose, fileName, content }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content file-viewer-modal" onClick={e => e.stopPropagation()} style={{
                width: '80%',
                maxWidth: '800px',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#ffffff',
                color: '#333333',
                border: '1px solid #ccc'
            }}>
                <div className="modal-header" style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef', color: '#333', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                    <h3 style={{ color: '#333' }}>{fileName}</h3>
                    <button className="close-btn" onClick={onClose} style={{ color: '#666' }}>&times;</button>
                </div>
                <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', background: '#ffffff' }}>
                    <pre style={{
                        width: '100%',
                        height: '100%',
                        overflow: 'auto',
                        background: '#ffffff',
                        color: '#212529',
                        padding: '1rem',
                        borderRadius: '0',
                        margin: 0,
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        border: 'none'
                    }}>
                        <code>{content}</code>
                    </pre>
                </div>
                <div className="modal-footer" style={{ background: '#f8f9fa', borderTop: '1px solid #e9ecef', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <button className="btn-ghost" onClick={onClose} style={{ color: '#333', borderColor: '#ccc' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default FileViewerModal;
