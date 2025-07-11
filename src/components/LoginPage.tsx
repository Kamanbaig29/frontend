import React, { useState } from 'react';
import bs58 from 'bs58';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.319,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const PhantomIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2.5-9.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm5 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-2.5 5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z" />
    </svg>
)

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<'login' | 'signup' | 'otp'>('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleApiCall = async (url: string, payload: object, successMessage: string) => {
    setError('');
    setMessage('');
    try {
      const response = await fetch(`http://localhost:4000${url}`, {
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
        localStorage.setItem('userId', data.userId); // <-- YEH LINE ADD KARO
      }
      window.location.reload();
      return data;

    } catch (err: any) {
      setError(err.message);
      throw err; // Re-throw to be caught by the calling function if needed
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleApiCall('/api/auth/signup', { name, email, password }, 'OTP sent!');
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
        window.location.reload();
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

      const response = await fetch('http://localhost:4000/api/auth/phantom-login', {
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
      alert('Phantom login cancelled or failed');
    }
  };

  const renderForm = () => {
    if (view === 'otp') {
      return (
        <form className="space-y-6" onSubmit={handleVerify}>
          <div className="relative">
            <input id="otp" name="otp" type="text" required
              className="peer h-10 w-full bg-gray-700 border-b-2 border-gray-600 text-gray-100 placeholder-transparent focus:outline-none focus:border-blue-500"
              placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <label htmlFor="otp" className="absolute left-0 -top-3.5 text-gray-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-blue-400 peer-focus:text-sm">
              One-Time Password (OTP)
            </label>
          </div>
          <button type="submit" className="w-full ...">Verify Account</button>
        </form>
      );
    }
    
    return (
      <form className="space-y-6" onSubmit={view === 'login' ? handleLogin : handleSignup}>
        {view === 'signup' && (
          <div className="relative">
             <input id="name" name="name" type="text" required
                className="peer h-10 w-full bg-gray-700 border-b-2 border-gray-600 text-gray-100 placeholder-transparent focus:outline-none focus:border-blue-500"
                placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
             <label htmlFor="name" className="absolute left-0 -top-3.5 text-gray-400 text-sm ...">Full Name</label>
          </div>
        )}
        <div className="relative">
           <input id="email" name="email" type="email" required
              className="peer h-10 w-full bg-gray-700 border-b-2 border-gray-600 text-gray-100 placeholder-transparent focus:outline-none focus:border-blue-500"
              placeholder="john@doe.com" value={email} onChange={(e) => setEmail(e.target.value)} />
           <label htmlFor="email" className="absolute left-0 -top-3.5 text-gray-400 text-sm ...">Email Address</label>
        </div>
        <div className="relative">
           <input id="password" name="password" type="password" required
              className="peer h-10 w-full bg-gray-700 border-b-2 border-gray-600 text-gray-100 placeholder-transparent focus:outline-none focus:border-blue-500"
              placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
           <label htmlFor="password" className="absolute left-0 -top-3.5 text-gray-400 text-sm ...">Password</label>
        </div>
        <button type="submit" className="w-full px-4 py-2 font-bold text-white bg-blue-600 ...">
            {view === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    );
  };

  //console.log('LoginPage rendered');

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
        <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-xl shadow-lg">
          <div className="text-center">
              <h2 className="text-3xl font-bold text-white">
                  {view === 'login' && 'Login'}
                  {view === 'signup' && 'Create Account'}
                  {view === 'otp' && 'Verify Your Account'}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                  {view === 'otp' ? `An OTP has been sent to ${email}` : 'Welcome! Please fill in your details.'}
              </p>
          </div>
          {view !== 'otp' && (
               <div className="flex items-center space-x-4">
                  <button className="w-full inline-flex ..."><GoogleIcon /><span>Google</span></button>
                  <button onClick={handlePhantomLogin} className="w-full inline-flex ...">
                    <PhantomIcon />
                    <span>Phantom</span>
                  </button>
               </div>
          )}
          {view !== 'otp' && (<div className="flex items-center justify-between"><span className="w-1/4 border-b"></span><p>OR</p><span className="w-1/4 border-b"></span></div>)}
          
          {renderForm()}
          
          {error && <p className="text-sm text-red-500 text-center pt-4">{error}</p>}
          {message && <p className="text-sm text-green-500 text-center pt-4">{message}</p>}

          <p className="text-sm text-center text-gray-400">
            {view === 'login' ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="ml-1 font-bold text-blue-400 hover:underline">
              {view === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

        </div>
      </div>
    </>
  );
};

export default LoginPage;
