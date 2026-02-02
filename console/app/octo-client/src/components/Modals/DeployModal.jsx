import React, { useState, useEffect } from 'react';
import './Modal.css';

const DeployModal = ({ isOpen, onClose, onDeploy, metadata, startLoading }) => {
    const [inputs, setInputs] = useState({
        objectType: '',
        objectName: '',
        packageName: '',
        trNumber: '',
        description: ''
    });

    useEffect(() => {
        if (isOpen) {
            setInputs({
                objectType: metadata.objectType || '',
                objectName: metadata.objectName || '',
                packageName: '', // No default
                trNumber: '', // No default
                description: metadata.objectName ? `Create ${metadata.objectName}` : ''
            });
        }
    }, [isOpen, metadata]);

    const handleChange = (field, val) => {
        setInputs(prev => ({ ...prev, [field]: val }));
    };

    const handleDeploy = () => {
        // Validation: All fields required except description (user said "all info must be entered")
        if (!inputs.objectType) { alert("Object Type is required."); return; }
        if (!inputs.objectName) { alert("Object Name is required."); return; }
        if (!inputs.packageName) { alert("Package Name is required."); return; }
        if (!inputs.trNumber) { alert("Transport Request (TR) is required."); return; }

        onDeploy(inputs);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', background: '#fcfcfc', color: '#000', border: '1px solid #ccc' }}>
                <div className="modal-header" style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                    <h3 style={{ color: '#000' }}>Deploy to SAP System</h3>
                    <button className="close-btn" onClick={onClose} style={{ color: '#555' }}>&times;</button>
                </div>
                <div className="modal-body" style={{ padding: '20px', background: '#fff' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#000', fontWeight: '500' }}>Object Type</label>
                        <input
                            type="text"
                            value={inputs.objectType}
                            //readOnly
                            style={inputStyle}
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#000', fontWeight: '500' }}>Object Name <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            value={inputs.objectName}
                            onChange={e => handleChange('objectName', e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <hr style={{ border: 0, borderTop: '1px solid #eee', margin: '20px 0' }} />

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#000', fontWeight: '500' }}>Package <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            value={inputs.packageName}
                            onChange={e => handleChange('packageName', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#000', fontWeight: '500' }}>Transport Request (TR) <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            value={inputs.trNumber}
                            onChange={e => handleChange('trNumber', e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#000', fontWeight: '500' }}>Description</label>
                        <textarea
                            value={inputs.description}
                            onChange={e => handleChange('description', e.target.value)}
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                        />
                    </div>
                </div>
                <div className="modal-footer" style={{ background: '#f5f5f5', borderTop: '1px solid #ddd' }}>
                    <button className="btn-ghost" onClick={onClose} style={{ marginRight: '10px', color: '#333', borderColor: '#ccc' }}>Cancel</button>
                    <button className="btn-primary" onClick={handleDeploy} disabled={startLoading}>
                        {startLoading ? 'Deploying...' : 'Deploy'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Styles
const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    background: '#ffffff',
    color: '#000000',
    fontSize: '14px',
    outline: 'none'
};

const readOnlyStyle = {
    ...inputStyle,
    background: '#f0f0f0',
    color: '#666',
    border: '1px solid #ddd',
    cursor: 'default'
};

export default DeployModal;
