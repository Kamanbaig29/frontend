import React, { useState, useEffect } from 'react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchWalletInfo();
    }
  }, [isOpen]);

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
        setBalance(data.balance || '0');
      }
    } catch (err) {
      console.error('Error fetching wallet info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Your Bot Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Balance */}
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Balance</p>
                <p className="text-2xl font-bold text-white">{balance} SOL</p>
              </div>
            </div>

            {/* Wallet Address */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Wallet Address:
              </label>
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-white font-mono text-sm break-all">
                  {walletAddress}
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-900 bg-opacity-30 p-4 rounded border border-blue-500">
              <h3 className="text-blue-400 font-semibold mb-2">How to Deposit:</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Send SOL to the wallet address above</li>
                <li>• Your bot will use this wallet for trading</li>
                <li>• Minimum recommended: 0.1 SOL</li>
                <li>• Balance updates automatically</li>
              </ul>
            </div>

            {/* Copy Address Button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(walletAddress);
                alert('Wallet address copied!');
              }}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              📋 Copy Address
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletModal;
