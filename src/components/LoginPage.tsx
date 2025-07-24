import React, { useState } from 'react';
import bs58 from 'bs58';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onClose?: () => void;
}

// amazonq-ignore-next-line
const LoginPage: React.FC<LoginPageProps> = ({ onClose }) => {
  const [view, setView] = useState<'login' | 'signup' | 'otp'>('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null); // For development: store OTP

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  //const WS_URL = import.meta.env.VITE_WS_URL; // If needed for WebSocket

  const handleApiCall = async (url: string, payload: object, successMessage: string) => {
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An unknown error occurred');
      }
      
      setMessage(data.message || successMessage);
      localStorage.setItem('token', data.token);
      if (data.userId) {
        localStorage.setItem('userId', data.userId);
      }
      if (data.otp) {
        setDevOtp(data.otp);
      }
      return data;

    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await handleApiCall('/api/auth/signup', { name, email, password }, 'OTP sent!');
      if (data.otp) {
        setDevOtp(data.otp);
      }
      setView('otp'); // Switch to OTP view on success
    } catch (error) {
      // Error is already set by handleApiCall
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleApiCall('/api/auth/verify-otp', { email, otp }, 'Verification successful!');
      alert('Account verified! Please log in.');
      setView('login'); // Switch to login view on success
      setOtp('');
    } catch (error) {
      // Error is already set by handleApiCall
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await handleApiCall('/api/auth/login', { email, password }, 'Login successful!');
      if (data.token) {
        localStorage.setItem('token', data.token);
        window.location.reload(); // <-- SIRF YAHAN RELOAD KARO
      }
    } catch (error) {
       // Error is already set by handleApiCall
    }
  };

  const handlePhantomLogin = async () => {
    // Check if Phantom is installed
    const provider = (window as any).solana;
    if (!provider || !provider.isPhantom) {
      alert('Please install the Phantom Wallet extension!');
      return;
    }

    try {
      // Connect to Phantom
      const resp = await provider.connect();
      const publicKey = resp.publicKey.toString();

      // Sign a message for authentication
      const message = `Sign in to Token Bot at ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await provider.signMessage(encodedMessage, "utf8");

      // Send publicKey, message, and signature to backend for verification
      const signature = bs58.encode(signed.signature);

      const response = await fetch(`${API_BASE_URL}/api/auth/phantom-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey,
          message,
          signature,
        }),
      });

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.userId) {
          localStorage.setItem('userId', data.userId); // <-- YEH LINE ADD KARO
        }
        window.location.reload();
      } else {
        alert(data.message || 'Phantom login failed');
      }
    } catch (err: any) {
      // amazonq-ignore-next-line
      alert('Phantom login cancelled or failed');
    }
  };

  const renderForm = () => {
    if (view === 'otp') {
      return (
        <form className="space-y-4 mb-6" onSubmit={handleVerify}>
          <div className="relative">
            <input id="otp" name="otp" type="text" required
              className="w-full px-4 py-3 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none transition text-center text-lg tracking-widest"
              style={{ 
                background: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid rgba(90, 0, 110, 0.3)'
              }}
              placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
          </div>
          {/* Show dev OTP for development only */}
          {devOtp && (
            <div className="mt-2 text-center text-yellow-400 text-lg font-bold">
              Dev OTP: {devOtp}
            </div>
          )}
          <button type="submit" className="button-primary">
            Verify Account
          </button>
        </form>
      );
    }
    
    return (
      <form className="mb-6" onSubmit={view === 'login' ? handleLogin : handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {view === 'signup' && (
          <div className="input-wrapper">
             <input id="name" name="name" type="text" required
                className="input-field"
                placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="input-wrapper">
           <input id="email" name="email" type="email" required
              className="input-field"
              placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="input-wrapper">
           <input id="password" name="password" type="password" required
              className="input-field"
              placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
           {view === 'login' && (
             <div className="forgot-password">
               <button type="button" className="forgot-password-button">
                 Forgot Password?
               </button>
             </div>
           )}
        </div>
        <button type="submit" className="button-primary">
          {view === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    );
  };

  //console.log('LoginPage rendered');

  return (
    <>
      <div className="login-modal">
        <div className="login-container">
          {/* Header with close button and title */}
          <div className="login-header">
            <div style={{ flex: 1 }}></div>
            <h2 className="login-title">
              {view === 'login' && 'Sign In'}
              {view === 'signup' && 'Create Account'}
              {view === 'otp' && 'Verify Your Account'}
            </h2>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {onClose && (
                <button onClick={onClose} className="close-button">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Logo */}
          <div className="logo-container">
            <img 
              src="/src/assets/tokenx-logo/t-transparent.png" 
              alt="TOKONX" 
              className="logo"
            />
          </div>

          {view === 'otp' ? (
            <>
              <p className="text-center text-sm text-gray-400 mb-6">
                An OTP has been sent to {email}
              </p>
              {renderForm()}
            </>
          ) : (
            <>
              {/* Email and Password inputs */}
              {renderForm()}
              
              {/* Google Button */}
              <button className="button-social">
                <img 
                  src="/src/assets/footerIcon/google.svg" 
                  alt="Google" 
                  style={{ width: '20px', height: '20px' }} 
                />
                <span>Continue with Google</span>
              </button>
              
              {/* Phantom Button */}
              <button onClick={handlePhantomLogin} className="button-social">
                <img 
                  src="/src/assets/footerIcon/phantom.svg" 
                  alt="Phantom" 
                  style={{ width: '20px', height: '20px' }} 
                />
                <span>Continue with Phantom</span>
              </button>
              
              {/* Sign up link */}
              <p className="text-sm text-center text-gray-400">
                {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="ml-1 font-bold hover:underline" style={{ color: '#D100FF' }}>
                  {view === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
          
          {error && <p className="text-sm text-red-500 text-center pt-4">{error}</p>}
          {message && <p className="text-sm text-green-500 text-center pt-4">{message}</p>}
        </div>
      </div>
    </>
  );
};

export default LoginPage;
