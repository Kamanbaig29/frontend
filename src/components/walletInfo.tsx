import React, { useState, useEffect } from 'react';

interface WalletInfoProps {
  onLogout: () => void;
}

const WalletInfo: React.FC<WalletInfoProps> = ({ onLogout }) => {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWalletInfo();
  }, []);

  const fetchWalletInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/auth/wallet-info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWalletAddress(data.walletAddress);
      } else {
        setError('Failed to fetch wallet info');
      }
    } catch (err) {
      setError('Error fetching wallet info');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white">Loading wallet info...</div>;
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Your Bot Wallet</h2>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
      
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400">Wallet Address:</label>
            <p className="text-white font-mono text-sm break-all">{walletAddress}</p>
          </div>
          
          <div className="bg-gray-700 p-4 rounded">
            <p className="text-gray-300 text-sm">
              �� <strong>How to use:</strong> Send SOL to this address to fund your bot wallet. 
              The bot will use this wallet for all trading operations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletInfo;
