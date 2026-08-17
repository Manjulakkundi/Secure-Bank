import React from 'react';
import { Link } from 'react-router-dom';
const NotFound = () => (
  <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f7fa' }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:80 }}>🏦</div>
      <h1 style={{ fontSize:48, color:'#1A3C5E', margin:'16px 0 8px' }}>404</h1>
      <p style={{ color:'#888', fontSize:16, marginBottom:28 }}>Page not found</p>
      <Link to="/dashboard" style={{ background:'#1A3C5E', color:'#fff', padding:'12px 28px', borderRadius:8, textDecoration:'none', fontWeight:700 }}>Go to Dashboard</Link>
    </div>
  </div>
);
export default NotFound;
