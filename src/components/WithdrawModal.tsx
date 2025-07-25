import React from 'react';
import '../assets/WithdrawModal.css';
import { useWebSocket } from '../context/webSocketContext';

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress?: string;
  solBalance?: number;
  onNotification: (notification: {show: boolean, message: string, type: 'success'|'error'}) => void;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ open, onClose, solBalance, onNotification }) => {
  const [destinationAddress, setDestinationAddress] = React.useState('');
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { ws } = useWebSocket();
  // Disable scroll when modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.body.style.width = 'auto';
    };
  }, [open]);

  // Validation logic
  const getButtonState = () => {
    if (!destinationAddress.trim()) {
      return { disabled: true, text: 'Invalid Address' };
    }
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      return { disabled: true, text: 'Amount 0' };
    }
    if (parseFloat(withdrawAmount) > (solBalance || 0)) {
      return { disabled: true, text: 'Invalid Amount' };
    }
    return { disabled: false, text: 'Send' };
  };

  const buttonState = getButtonState();

  const handleSend = async () => {
    if (buttonState.disabled || isLoading) return;
    
    setIsLoading(true);
    onNotification({show: true, message: 'Sending transaction...', type: 'success'});
    onClose(); // Close modal immediately
    
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          destinationAddress,
          amount: withdrawAmount,
          userId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onNotification({show: true, message: `Transaction sent! Signature: ${data.signature.slice(0,8)}...`, type: 'success'});
        
        // Send balance update via WebSocket
        if (ws && data.newBalance !== undefined) {
          ws.send(JSON.stringify({
            type: "WITHDRAW_SUCCESS",
            newBalance: data.newBalance
          }));
        }
        
        setDestinationAddress('');
        setWithdrawAmount('');
        
        setTimeout(() => {
          onNotification({show: false, message: '', type: 'success'});
        }, 3000);
      } else {
        onNotification({show: true, message: `Transaction failed: ${data.error}`, type: 'error'});
      }
    } catch (error) {
      onNotification({show: true, message: 'Transaction failed: Network error', type: 'error'});
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="withdraw-modal">
        <div className="modal-header">
          <h3>Withdraw</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button className="withdraw-modal-button">
              Withdraw
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
          <input 
            type="text" 
            placeholder="Destination Address" 
            className="destination-address-input"
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
          />
          
          
          
          <div className="arrow-down">↓</div>
          
          <div className="warning-text">
            <img src="/navbar/coin.png" alt="SOL" className="warning-sol-icon" />
            Transfer in SOL chain
          </div>
          
          <div className="withdraw-amount-box">
            <div className="withdraw-amount-label">Withdraw Amount</div>
            <div className="withdraw-amount-input-section">
              <input 
                type="number" 
                placeholder="0.0" 
                className="withdraw-amount-input"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <div className="withdraw-currency">
                <img src="/navbar/coin.png" alt="SOL" className="withdraw-sol-icon" />
                <span>SOL</span>
              </div>
            </div>
          </div>
          
          
          {/* <div className="to-amount-box">
            <div className="to-amount-label">To</div>
            <div className="to-amount-input-section">
              <input 
                type="text" 
                placeholder="0.0" 
                className="to-amount-input"
              />
              <div className="to-currency">
                <img src="/navbar/coin.png" alt="SOL" className="to-sol-icon" />
                <span>SOL</span>
              </div>
            </div>
          </div>
           */}
          <div className="divider"></div>
          
          <button 
            className={`send-button ${buttonState.disabled || isLoading ? 'disabled' : ''}`}
            disabled={buttonState.disabled || isLoading}
            onClick={handleSend}
          >
            {isLoading ? 'Sending...' : buttonState.text}
          </button>
          

        </div>
      </div>
    </>
  );
};

export default WithdrawModal;