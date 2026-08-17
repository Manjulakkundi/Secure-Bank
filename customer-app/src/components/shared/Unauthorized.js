import React from 'react';
import { Link } from 'react-router-dom';
const Unauthorized = () => (
  <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f7fa' }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:64 }}>🔒</div>
      <h1 style={{ fontSize:36, color:'#C0392B', margin:'16px 0 8px' }}>Access Denied</h1>
      <p style={{ color:'#888', fontSize:15, marginBottom:28 }}>You don't have permission to view this page.</p>
      <Link to="/login" style={{ background:'#1A3C5E', color:'#fff', padding:'12px 28px', borderRadius:8, textDecoration:'none', fontWeight:700 }}>Back to Login</Link>
    </div>
  </div>
);
export default Unauthorized;
