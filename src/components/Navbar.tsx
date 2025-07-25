import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGear, faGear } from '@fortawesome/free-solid-svg-icons';
import '../assets/Navbar.css'; // Adjust the path as necessary

interface NavbarProps {
  showMyTokens?: boolean;
  onMyTokensClick?: () => void;
  onDepositClick?: () => void;
  onWithdrawClick?: () => void;
  onLogout?: () => void;
  solBalance?: number;
}

const Navbar: React.FC<NavbarProps> = ({ showMyTokens, onMyTokensClick, onDepositClick, onWithdrawClick, onLogout, solBalance }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [activeNav, setActiveNav] = useState(showMyTokens ? 'portfolio' : 'discover');


  // Sync activeNav with showMyTokens prop
  React.useEffect(() => {
    setActiveNav(showMyTokens ? 'portfolio' : 'discover');
  }, [showMyTokens]);

  // Fetch SOL price when dropdown opens
  const fetchSolPrice = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sol-price`);
      const data = await response.json();
      setSolPrice(data.price || 0);
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);
    }
  };

  React.useEffect(() => {
    if (walletDropdownOpen) {
      fetchSolPrice();
    }
  }, [walletDropdownOpen]);

  return (
    <div className="navbar">
      {/* Logo and Brand */}
      <div className="navbar-brand">
        <img 
          src="/tokenx-logo/t-transparent.png" 
          alt="TOKENX" 
          className="navbar-logo"
        />
        <h1 className="navbar-title">
          TOKENX
        </h1>
      </div>
      
      {/* Navigation Buttons */}
      <div className="navbar-nav">
        <button 
          className={`nav-button ${activeNav === 'discover' ? 'active' : ''}`}
          onClick={() => {
            setActiveNav('discover');
            if (showMyTokens && onMyTokensClick) {
              onMyTokensClick(); // Toggle back to all tokens
            }
          }}
        >
          Discover
        </button>
        <button 
          className={`nav-button ${activeNav === 'portfolio' ? 'active' : ''}`}
          onClick={() => {
            setActiveNav('portfolio');
            onMyTokensClick?.();
          }}
        >
          Portfolio
        </button>
      </div>
      
      {/* Right Side Actions */}
      <div className="navbar-actions">
        <button className="deposit-button desktop-only" onClick={onDepositClick}>
          Deposit
        </button>
        <div className="wallet-balance-container desktop-only">
          <div className="wallet-balance" onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}>
            <img src="/navbar/wallet.png" alt="Wallet" className="wallet-icon" />
            <img src="/navbar/coin.png" alt="SOL" className="sol-icon" />
            <span className="balance-text">{(solBalance || 0)}</span>
          </div>
          {walletDropdownOpen && (
            <div className="wallet-dropdown">
              <div className="wallet-dropdown-section">
                <div>Total Value</div>
                <div>${((solBalance || 0) * solPrice)}</div>
              </div>
              <div className="wallet-dropdown-section">
                <div className="wallet-buttons">
                  <button className="wallet-btn deposit-btn" onClick={onDepositClick}>Deposit</button>
                  <button className="wallet-btn withdraw-btn" onClick={onWithdrawClick}>Withdraw</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="dropdown-container">
          <button className="profile-button desktop-only" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <FontAwesomeIcon icon={faUserGear} className="profile-icon" />
          </button>
          <button className="mobile-menu mobile-only" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <FontAwesomeIcon icon={faGear} className="mobile-icon" />
          </button>
          
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item">Settings</div>
              <div className="dropdown-item">Profile</div>
              <div className="dropdown-item" onClick={onLogout}>Logout</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;