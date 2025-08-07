import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserGear, faGear, faRocket, faArrowRightFromBracket, faUser, faWallet } from '@fortawesome/free-solid-svg-icons';
import AccountSettingsModal from './AccountSettingModal';
import '../assets/Navbar.css';

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
  const [desktopWalletDropdownOpen, setDesktopWalletDropdownOpen] = useState(false);
  const [mobileWalletDropdownOpen, setMobileWalletDropdownOpen] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  // Refs for dropdown containers
  const dropdownRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
  const mobileWalletRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close profile dropdown if clicked outside
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      
      // Close desktop wallet dropdown if clicked outside
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target as Node)) {
        setDesktopWalletDropdownOpen(false);
      }
      
      // Close mobile wallet dropdown if clicked outside
      if (mobileWalletRef.current && !mobileWalletRef.current.contains(event.target as Node)) {
        setMobileWalletDropdownOpen(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  useEffect(() => {
    if (desktopWalletDropdownOpen || mobileWalletDropdownOpen) {
      fetchSolPrice();
    }
  }, [desktopWalletDropdownOpen, mobileWalletDropdownOpen]);

  const handleAccountSettingsClick = () => {
    setAccountSettingsOpen(true);
    setDropdownOpen(false); // Close the dropdown when opening modal
  };

  return (
    <>
      <div className="navbar">
        {/* Logo and Brand - Desktop Only */}
        <div className="navbar-brand desktop-only">
          <img 
            src="/tokenx-logo/t-transparent.png" 
            alt="TOKENX" 
            className="navbar-logo"
          />
          <h1 className="navbar-title">TOKENX</h1>
        </div>
        
        {/* Mobile Navigation Buttons */}
        <div className="navbar-nav mobile-only">
          <button 
            className={`nav-button ${!showMyTokens ? 'active' : ''}`}
            onClick={() => {
              if (showMyTokens && onMyTokensClick) {
                onMyTokensClick(); // Toggle back to all tokens
              }
            }}
          >
            Discover
          </button>
          <button 
            className={`nav-button ${showMyTokens ? 'active' : ''}`}
            onClick={() => {
              if (!showMyTokens && onMyTokensClick) {
                onMyTokensClick(); // Toggle to portfolio
              }
            }}
          >
            Portfolio
          </button>
        </div>
        
        {/* Desktop Navigation Buttons */}
        <div className="navbar-nav desktop-only">
          <button 
            className={`nav-button ${!showMyTokens ? 'active' : ''}`}
            onClick={() => {
              if (showMyTokens && onMyTokensClick) {
                onMyTokensClick(); // Toggle back to all tokens
              }
            }}
          >
            Discover
          </button>
          <button 
            className={`nav-button ${showMyTokens ? 'active' : ''}`}
            onClick={() => {
              if (!showMyTokens && onMyTokensClick) {
                onMyTokensClick(); // Toggle to portfolio
              }
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
          <div className="wallet-balance-container desktop-only" ref={walletDropdownRef}>
            <div className="wallet-balance" onClick={() => setDesktopWalletDropdownOpen(!desktopWalletDropdownOpen)}>
              <img src="/navbar/wallet.png" alt="Wallet" className="wallet-icon" />
              <img src="/navbar/coin.png" alt="SOL" className="sol-icon" />
              <span className="balance-text">{(solBalance || 0)}</span>
            </div>
            {desktopWalletDropdownOpen && (
              <div className="wallet-dropdown">
                <div className="wallet-dropdown-section">
                  <div>Total Value</div>
                  <div>
                    {(solBalance || 0) > 0 && solPrice === 0 ? (
                      <div className="wallet-value-skeleton"></div>
                    ) : (
                      <>${((solBalance || 0) * solPrice)}</>
                    )}
                  </div>
                </div>
                <div className="wallet-dropdown-section">
                  <div className="wallet-buttons">
                    <button 
                      className="wallet-btn deposit-btn" 
                      onClick={() => {
                        onDepositClick?.();
                        setDesktopWalletDropdownOpen(false);
                      }}
                    >
                      Deposit
                    </button>
                    <button 
                      className="wallet-btn withdraw-btn" 
                      onClick={() => {
                        onWithdrawClick?.();
                        setDesktopWalletDropdownOpen(false);
                      }}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile Wallet Icon and Dropdown */}
          <div className="mobile-wallet-container mobile-only" ref={mobileWalletRef}>
            <button className="mobile-wallet-btn" onClick={() => setMobileWalletDropdownOpen(!mobileWalletDropdownOpen)}>
              <FontAwesomeIcon icon={faWallet} className="mobile-wallet-icon" />
            </button>
            
            {mobileWalletDropdownOpen && (
              <div className="mobile-wallet-dropdown">
                <div className="wallet-dropdown-section">
                  <div>Total Value</div>
                  <div>${((solBalance || 0) * solPrice)}</div>
                </div>
                <div className="wallet-dropdown-section">
                  <div className="wallet-buttons">
                    <button 
                      className="wallet-btn deposit-btn" 
                      onClick={() => {
                        onDepositClick?.();
                        setMobileWalletDropdownOpen(false);
                      }}
                    >
                      Deposit
                    </button>
                    <button 
                      className="wallet-btn withdraw-btn" 
                      onClick={() => {
                        onWithdrawClick?.();
                        setMobileWalletDropdownOpen(false);
                      }}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="dropdown-container" ref={dropdownRef}>
            <button className="profile-button desktop-only" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <FontAwesomeIcon icon={faUserGear} className="profile-icon" />
            </button>
            <button className="mobile-menu mobile-only" onClick={() => setDropdownOpen(!dropdownOpen)}>
              <FontAwesomeIcon icon={faGear} className="mobile-icon" />
            </button>
            
            {dropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={handleAccountSettingsClick}>
                  <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px' }} />
                  Account & Settings
                </div>
                <div className="dropdown-item">
                  <FontAwesomeIcon icon={faRocket} style={{ marginRight: '8px' }} />
                  Features and Update
                </div>
                <div className="dropdown-item logout-item" onClick={onLogout}>
                  <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ marginRight: '8px' }} />
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <AccountSettingsModal 
        open={accountSettingsOpen} 
        onClose={() => setAccountSettingsOpen(false)}
        onLogout={onLogout}
      />
    </>
  );
};

export default Navbar;