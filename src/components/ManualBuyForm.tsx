import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useWebSocket } from "../context/webSocketContext";

export const ManualBuyForm: React.FC = () => {
  const { ws, status, sendMessage } = useWebSocket();
  const [mintAddress, setMintAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [slippage, setSlippage] = useState("1"); // Default 1%
  const [priorityFee, setPriorityFee] = useState("0.001"); // Default 0.001 SOL
  const [bribeAmount, setBribeAmount] = useState("0"); // Default 0 SOL

  useEffect(() => {
    const storedWalletAddress = import.meta.env.VITE_BUYER_PUBLIC_KEY || "";
    if (!storedWalletAddress) {
      setError(
        "Wallet address not found in environment variables. Cannot perform buy."
      );
      return;
    }
    setWalletAddress(storedWalletAddress);

    const handleMessage = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        console.log("ManualBuyForm received message:", response);

        if (response.type === "MANUAL_BUY_SUCCESS") {
          setSuccess(
            `Token bought successfully! Transaction: ${response.signature}. Time: ${response.details.executionTimeMs}ms`
          );
          setMintAddress("");
          setAmount("");
          setPrivateKey("");
        } else if (response.type === "MANUAL_BUY_ERROR") {
          setError(response.error || "Transaction failed");
        }
      } catch (err) {
        setError("Failed to process server response");
      } finally {
        setLoading(false);
      }
    };

    if (ws && status === "connected") {
      ws.addEventListener("message", handleMessage);
    }

    return () => {
      if (ws) {
        ws.removeEventListener("message", handleMessage);
      }
    };
  }, [ws, status, sendMessage, walletAddress]);

  useEffect(() => {
    // Send mode change message when component mounts
    if (ws && status === "connected") {
      sendMessage({
        type: "SET_MODE",
        mode: "manual",
      });
    }
  }, [ws, status, sendMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("WebSocket is not connected. Please wait or check server.");
      setLoading(false);
      return;
    }

    if (!mintAddress || !amount /* || !privateKey */ || !walletAddress) {
      setError(
        "All fields are required, including the wallet address from environment."
      );
      setLoading(false);
      return;
    }

    try {
      const messageToSend = {
        type: "MANUAL_BUY",
        mintAddress, // string
        amount: Math.floor(Number(amount) * 1_000_000_000), // lamports (number)
        slippage: Number(slippage),
        priorityFee: Math.floor(Number(priorityFee) * 1_000_000_000),
        bribeAmount: Math.floor(Number(bribeAmount) * 1_000_000_000),
      };

      console.log("ManualBuyForm: Sending MANUAL_BUY message:", messageToSend);
      sendMessage(messageToSend);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred during buy request."
      );
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mt: 3,
        bgcolor: "#6A5ACD",
        color: "white",
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
        Manual Token Buy
      </Typography>

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Token Mint Address"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            required
            fullWidth
            variant="outlined"
            sx={{
              "& .MuiInputBase-input": { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
                "&.Mui-focused fieldset": { borderColor: "white" },
              },
            }}
          />

          <TextField
            label="Amount (SOL)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            fullWidth
            variant="outlined"
            inputProps={{
              min: "0.1",
              step: "0.1",
              pattern: "^[0-9]*[.]?[0-9]*$",
            }}
            sx={{
              "& .MuiInputBase-input": { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
                "&.Mui-focused fieldset": { borderColor: "white" },
              },
            }}
          />

          {/* <TextField
            label="Wallet Private Key"
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            required
            fullWidth
            variant="outlined"
            sx={{
              '& .MuiInputBase-input': { color: 'white' },
              '& .MuiInputLabel-root': { color: 'white' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'white' },
                '&:hover fieldset': { borderColor: 'white' },
                '&.Mui-focused fieldset': { borderColor: 'white' }
              }
            }}
          /> */}

          <TextField
            label="Slippage (%)"
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            required
            fullWidth
            variant="outlined"
            inputProps={{
              min: "0.1",
              max: "100",
              step: "0.1",
            }}
            sx={{
              "& .MuiInputBase-input": { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
                "&.Mui-focused fieldset": { borderColor: "white" },
              },
            }}
          />

          <TextField
            label="Priority Fee (SOL)"
            type="number"
            value={priorityFee}
            onChange={(e) => setPriorityFee(e.target.value)}
            required
            fullWidth
            variant="outlined"
            inputProps={{
              min: "0",
              step: "0.001",
            }}
            sx={{
              "& .MuiInputBase-input": { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
                "&.Mui-focused fieldset": { borderColor: "white" },
              },
            }}
          />

          <TextField
            label="Bribe Amount (SOL)"
            type="number"
            value={bribeAmount}
            onChange={(e) => setBribeAmount(e.target.value)}
            required
            fullWidth
            variant="outlined"
            inputProps={{
              min: "0",
              step: "0.001",
            }}
            sx={{
              "& .MuiInputBase-input": { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "white" },
                "&:hover fieldset": { borderColor: "white" },
                "&.Mui-focused fieldset": { borderColor: "white" },
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={loading || status !== "connected"}
            fullWidth
            sx={{
              bgcolor: "#483D8B",
              "&:hover": { bgcolor: "#372B7A" },
              height: "48px",
              fontSize: "1.1rem",
              fontWeight: "bold",
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Buy Token"
            )}
          </Button>
        </Box>
      </form>

      {error && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{
            mt: 2,
            "& .MuiAlert-message": { color: "#2e7d32" },
          }}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
};
