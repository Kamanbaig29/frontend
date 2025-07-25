import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import '../assets/DepositModal.css'; // Ensure you have the correct path to your CSS file

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress?: string;
  solBalance?: number;
}

const DepositModal: React.FC<DepositModalProps> = ({ open, onClose, walletAddress, solBalance }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showCopyNotification, setShowCopyNotification] = useState(false);
  
  useEffect(() => {
    console.log('QR Effect:', { walletAddress, open });
    if (walletAddress && open) {
      console.log('Generating QR for:', walletAddress);
      QRCode.toDataURL(walletAddress, {
        width: 120,
        margin: 1,
        color: {
          dark: '#3f51b5',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })
      .then(url => {
        console.log('QR generated successfully');
        setQrCodeUrl(url);
      })
      .catch(err => console.error('QR Code generation failed:', err));
    } else {
      console.log('QR not generated - missing walletAddress or modal closed');
    }
  }, [walletAddress, open]);
  
  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setShowCopyNotification(true);
      setTimeout(() => setShowCopyNotification(false), 3000);
    }
  };
  
  if (!open) return null;

  return (
    <>
      {showCopyNotification && (
        <div className="copy-notification">
          Address copied to clipboard!
        </div>
      )}
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="deposit-modal">
        <div className="modal-header">
          <h3>Exchange</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button className="deposit-modal-button">
              Deposit
            </button>
          </div>
          
          <div className="balance-boxes">
            <div className="balance-box">
              <img src="/navbar/coin.png" alt="SOL" className="balance-icon" />
              <span>Solana</span>
            </div>
            <div className="balance-box">
              <span>{solBalance || 0}</span>
              <span>Balance</span>
            </div>
          </div>
          
          <div className="warning-text">
            Only deposit SOL through the Solana network for this address.
          </div>
          

          
          <div className="address-box">
            <div className="qr-section">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
              ) : (
                <div className="qr-placeholder">{walletAddress ? 'Loading...' : 'No Address'}</div>
              )}
            </div>
            <div className="address-section">
              <div className="address-label">Wallet Address</div>
              <span className="address-text">{walletAddress || 'Loading...'}</span>
            </div>
            <div className="copy-icon" onClick={handleCopyAddress}>
              <FontAwesomeIcon icon={faCopy} />
            </div>
          </div>
          
          <div className="partition-line"></div>
          
          <button className="copy-address-button" onClick={handleCopyAddress}>
            Copy Address
          </button>
        </div>
      </div>
    </>
  );
};

export default DepositModal;