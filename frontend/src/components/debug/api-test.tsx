'use client';

import { useState } from 'react';
import { getApiClient } from '@/services/api-client.service';

export function ApiTest() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setResults([]);
  };

  const testHealthEndpoint = async () => {
    log('Testing health endpoint...');
    try {
      const response = await fetch('/api/health');
      log(`Health status: ${response.status}`);
      const text = await response.text();
      log(`Health response: ${text}`);
    } catch (error) {
      log(`Health error: ${error}`);
    }
  };

  const testChatEndpointDirect = async () => {
    log('Testing chat endpoint directly...');
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'test message',
          userId: '0x1234567890123456789012345678901234567890'
        })
      });
      
      log(`Chat direct status: ${response.status}`);
      const data = await response.json();
      log(`Chat direct response: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      log(`Chat direct error: ${error}`);
    }
  };

  const testChatEndpointViaApiClient = async () => {
    log('Testing chat endpoint via API client...');
    try {
      const apiClient = getApiClient();
      const response = await apiClient.post('/chat/message', {
        message: 'test message',
        userId: '0x1234567890123456789012345678901234567890'
      });
      
      log(`Chat API client status: ${response.status}`);
      log(`Chat API client response: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      log(`Chat API client error: ${error}`);
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    clearLogs();
    
    await testHealthEndpoint();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testChatEndpointDirect();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testChatEndpointViaApiClient();
    
    setIsLoading(false);
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">API Debug Test</h3>
      
      <div className="space-x-2 mb-4">
        <button
          onClick={testHealthEndpoint}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Health
        </button>
        
        <button
          onClick={testChatEndpointDirect}
          disabled={isLoading}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Chat Direct
        </button>
        
        <button
          onClick={testChatEndpointViaApiClient}
          disabled={isLoading}
          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Chat API Client
        </button>
        
        <button
          onClick={runAllTests}
          disabled={isLoading}
          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          Run All Tests
        </button>
        
        <button
          onClick={clearLogs}
          disabled={isLoading}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      <div className="bg-black text-green-400 p-3 rounded font-mono text-sm h-64 overflow-y-auto">
        {results.length === 0 ? (
          <div className="text-gray-500">Click a test button to see results...</div>
        ) : (
          results.map((result, index) => (
            <div key={index}>{result}</div>
          ))
        )}
      </div>
    </div>
  );
}