import React, { useState } from 'react';
import { saveToSap } from './SapSetObject';

const SapLogin = ({ isLoggedIn, status, setStatus, isLoading, connect, disconnect, callMcpTool }) => {
    const [sapConfig, setSapConfig] = useState({
        url: '',
        client: '',
        user: '',
        password: ''
    });

    const [testInputs, setTestInputs] = useState({
        transport: 'S4HK902742',
        package: 'ZPK_IYH1HC',
        objectName: 'Z_CL_PO_PROCESS',
        sourceCode: `class Z_CL_PO_PROCESS definition
  public
  final
  create public .

public section.

  methods GET_PRICE_RANGES
    importing
      !IV_A type I
      !IV_B type I
    returning
      value(RV_SUBRC) type SY-SUBRC .
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS Z_CL_PO_PROCESS IMPLEMENTATION.
  METHOD get_price_ranges.
    rv_subrc = 4. 
  ENDMETHOD.
ENDCLASS.`
    });

    // Received MCP context from props

    const handleChange = (field, value) => {
        setSapConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleTestChange = (field, value) => {
        setTestInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleLogin = (e) => {
        e.preventDefault();
        connect(sapConfig);
    };

    const handleLogout = (e) => {
        e.preventDefault();
        disconnect();
    };

    const handleSave = async () => {
        await saveToSap(testInputs, callMcpTool, setStatus);
    };

    return (
        <div className="settings-panel" style={{ marginTop: '0', marginBottom: '20px' }}>
            <h2>SAP System Connection</h2>
            <form onSubmit={isLoggedIn ? handleLogout : handleLogin} className="settings-grid">
                <label className="field"><span>SAP URL</span><input type="text" placeholder="https://example.sap.corp:44300" value={sapConfig.url} onChange={(e) => handleChange('url', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>Client</span><input type="text" placeholder="100" value={sapConfig.client} onChange={(e) => handleChange('client', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>User</span><input type="text" placeholder="User" value={sapConfig.user} onChange={(e) => handleChange('user', e.target.value)} disabled={isLoggedIn || isLoading} /></label>
                <label className="field"><span>Password</span><input type="password" placeholder="Password" value={sapConfig.password} onChange={(e) => handleChange('password', e.target.value)} disabled={isLoggedIn || isLoading} /></label>

                {status.msg && (
                    <div style={{ fontSize: '12px', padding: '8px', borderRadius: '4px', background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: status.type === 'error' ? '#ef4444' : (status.type === 'success' ? '#10b981' : '#6b7280') }}>
                        {status.msg}
                    </div>
                )}
                <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                    {isLoading ? 'Connecting...' : (isLoggedIn ? 'Logout' : 'Login')}
                </button>
            </form>

{/*             {isLoggedIn && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                    <h3>Test MCP Operations</h3>
                    <div className="settings-grid">
                        <label className="field"><span>Transport (TR)</span><input type="text" value={testInputs.transport} onChange={(e) => handleTestChange('transport', e.target.value)} /></label>
                        <label className="field"><span>Package</span><input type="text" value={testInputs.package} onChange={(e) => handleTestChange('package', e.target.value)} /></label>
                        <label className="field"><span>Object Name</span><input type="text" value={testInputs.objectName} onChange={(e) => handleTestChange('objectName', e.target.value)} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Source Code</span><textarea value={testInputs.sourceCode} onChange={(e) => handleTestChange('sourceCode', e.target.value)} style={{ width: '100%', minHeight: '200px', fontFamily: 'monospace', fontSize: '12px', background: '#2d2d2d', color: '#f8f8f2', border: '1px solid #444', borderRadius: '4px', padding: '8px' }} /></label>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                        <button type="button" className="btn-primary" style={{ width: '100%', background: '#10b981' }} onClick={handleSave}>Save to SAP System</button>
                    </div>
                </div>
            )} */}
        </div>
    );
};

export default SapLogin;
