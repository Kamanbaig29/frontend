import React, { useState, useEffect } from 'react';
import WalletModal from './walletModal';

const WalletButton: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [balance, setBalance] = useState<string>('0');

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/auth/wallet-info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance || '0');
      }
    } catch (err) {
      setBalance('0');
    }
  };

  // Optionally, refresh balance when modal closes
  const handleClose = () => {
    setIsModalOpen(false);
    fetchBalance();
  };

  return (
    <div className="fixed top-4 left-4 flex items-center space-x-4 z-40">
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
      >
        <span className="text-lg">💰</span>
        <span>Wallet</span>
        <span className="ml-2 bg-gray-900 px-2 py-1 rounded text-yellow-300 font-mono text-xs">
          {balance} SOL
        </span>
      </button>
      <button
        onClick={onLogout}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg"
      >
        Logout
      </button>
      <WalletModal
        isOpen={isModalOpen}
        onClose={handleClose}
      />
    </div>
  );
};

export default WalletButton;
