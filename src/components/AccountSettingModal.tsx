import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faShield, faBell, faPalette, faLanguage, faQuestionCircle, faWallet, faArrowRightFromBracket, faCopy, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import '../assets/AccountSettingsModal.css';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

interface UserProfile {
  userId: string;
  formattedUserId: string;
  displayName: string;
  fullName: string | null;
  solanaAddress: string | null;
  botWalletAddress: string | null;
  email: string | null;
  isWalletUser: boolean;
  isEmailUser: boolean;
  hasBotWallet: boolean;
}

interface LanguageOption {
  value: string;
  label: string;
  flag: string;
}

const languageOptions: LanguageOption[] = [
  { value: 'English', label: 'English', flag: '/flags/us-flag.png' },
  { value: 'Spanish', label: 'Spanish', flag: '/flags/es-flag.png' },
  { value: 'French', label: 'French', flag: '/flags/fr-flag.png' },
  { value: 'German', label: 'German', flag: '/flags/de-flag.png' },
  { value: 'Hindi', label: 'Hindi', flag: '/flags/in-flag.png' }
];

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ open, onClose, onLogout }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      // Prevent scrolling when modal opens
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      fetchUserProfile();
      
      // Return cleanup function
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.width = '';
      };
    }
  }, [open]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/profile-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      } else {
        console.error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUserId = () => {
    if (userProfile?.userId) {
      navigator.clipboard.writeText(userProfile.userId);
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 3000);
    }
  };

  const getWalletAddressToShow = () => {
    if (!userProfile) return null;
    
    // For wallet users, show bot wallet address
    if (userProfile.isWalletUser && userProfile.botWalletAddress) {
      return userProfile.botWalletAddress;
    }
    
    // For email users, show bot wallet address if available
    if (userProfile.isEmailUser && userProfile.botWalletAddress) {
      return userProfile.botWalletAddress;
    }
    
    return null;
  };

  const selectedLanguageOption = languageOptions.find(option => option.value === selectedLanguage);

  if (!open) return null;

  return (
    <>
      {showCopyNotification && (
        <div className="copy-notification">
          User ID copied to clipboard!
        </div>
      )}
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="account-settings-modal">
        <div className="modal-header">
          <h3>Account & Settings</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {/* Profile Section */}
          <div className="profile-section">
            <div className="profile-info">
              {loading ? (
                // Skeleton Loading
                <>
                  <div className="skeleton-name"></div>
                  <div className="skeleton-id"></div>
                  <div className="skeleton-wallet"></div>
                </>
              ) : (
                // Actual Content
                <>
                  <div className="profile-name">
                    {userProfile?.displayName || 'Unknown User'}
                  </div>
                  <div className="profile-id-container">
                    <span className="profile-id">
                      {userProfile?.formattedUserId || ''}
                    </span>
                    <button 
                      className="copy-user-id-btn" 
                      onClick={handleCopyUserId}
                      title="Copy User ID"
                    >
                      <FontAwesomeIcon icon={faCopy} className="copy-icon-small" />
                    </button>
                  </div>
                  <div 
                    className="profile-wallet"
                    onMouseEnter={() => setShowFullAddress(true)}
                    onMouseLeave={() => setShowFullAddress(false)}
                  >
                    <FontAwesomeIcon icon={faWallet} className="wallet-icon-small" />
                    <span>
                      {showFullAddress && getWalletAddressToShow()
                        ? getWalletAddressToShow()
                        : 'Wallet Connected'
                      }
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Language Section */}
          <div className="settings-section">
            <div className="language-item">
              <div className="language-left">
                <FontAwesomeIcon icon={faLanguage} className="settings-icon" />
                <span>Language</span>
              </div>
              <div className="language-dropdown">
                <div 
                  className="language-select-custom"
                  onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                >
                  <div className="language-selected">
                    <img src={selectedLanguageOption?.flag} alt="Flag" className="flag-icon" />
                    <span>{selectedLanguageOption?.label}</span>
                  </div>
                  <FontAwesomeIcon icon={faChevronDown} className="dropdown-arrow" />
                </div>
                {languageDropdownOpen && (
                  <div className="language-dropdown-menu">
                    {languageOptions.map((option) => (
                      <div 
                        key={option.value}
                        className={`language-option ${selectedLanguage === option.value ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedLanguage(option.value);
                          setLanguageDropdownOpen(false);
                        }}
                      >
                        <img src={option.flag} alt="Flag" className="flag-icon" />
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Help & Support Section */}
          <div className="settings-section">
            <div className="settings-item">
              <FontAwesomeIcon icon={faQuestionCircle} className="settings-icon" />
              <span>Help & Support</span>
            </div>
          </div>

          {/* Logout Section */}
          <div className="settings-section">
            <div className="logout-item" onClick={onLogout}>
              <FontAwesomeIcon icon={faArrowRightFromBracket} className="logout-icon" />
              <span>Logout</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AccountSettingsModal;