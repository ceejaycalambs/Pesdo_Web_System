import React, { useState } from 'react';
import { testDatabaseConnection, initializeSampleData, firebaseDB } from '../services/firebaseService';

const DatabaseManager = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing database connection...');
    
    try {
      const result = await testDatabaseConnection();
      setStatus(result.success ? 
        '✅ Database connection successful!' : 
        `❌ Database connection failed: ${result.message}`
      );
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addSampleData = async () => {
    setLoading(true);
    setStatus('Adding sample data...');
    
    try {
      const result = await initializeSampleData();
      setStatus(result.success ? 
        '✅ Sample data added successfully!' : 
        `❌ Failed to add sample data: ${result.message}`
      );
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearJobs = async () => {
    if (!window.confirm('Are you sure you want to delete all jobs? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setStatus('Clearing all jobs...');
    
    try {
      const jobs = await firebaseDB.jobs.getAll();
      for (const job of jobs) {
        await firebaseDB.jobs.delete(job.id);
      }
      setStatus(`✅ Successfully deleted ${jobs.length} jobs`);
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '12px',
      border: '1px solid #e9ecef',
      margin: '20px 0'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#005177' }}>Database Manager</h3>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
        <button 
          onClick={testConnection}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#005177',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
        
        <button 
          onClick={addSampleData}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Adding...' : 'Add Sample Data'}
        </button>
        
        <button 
          onClick={clearJobs}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Clearing...' : 'Clear All Jobs'}
        </button>
      </div>
      
      {status && (
        <div style={{
          padding: '10px',
          backgroundColor: status.includes('✅') ? '#d4edda' : '#f8d7da',
          color: status.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '6px',
          border: `1px solid ${status.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

export default DatabaseManager;






