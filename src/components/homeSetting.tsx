import React, { useEffect, useState } from "react";
import {
  Modal,
  Box,
  TextField,
  Button,
} from "@mui/material";
import styles from "../assets/homeSetting.module.css";

interface HomeSettingProps {
  open: boolean;
  onClose: () => void;
  autoBuyEnabled: boolean;
  setAutoBuyEnabled: (v: boolean) => void;
  bufferAmount: string;
  setBufferAmount: (v: string) => void;
  manualBuyAmount: string;
  setManualBuyAmount: (v: string) => void;
}

const HomeSetting: React.FC<HomeSettingProps> = ({
  open,
  onClose,
  setAutoBuyEnabled,
  bufferAmount,
  setBufferAmount,
  manualBuyAmount,
  setManualBuyAmount,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const isButtonDisabled = bufferAmount.trim() === "";

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimateIn(true), 10);
    } else {
      setAnimateIn(false);
      setTimeout(() => setShowModal(false), 800);
    }
  }, [open]);

  // Sync state for external autoBuyEnabled (if needed)
  useEffect(() => {
    setAutoBuyEnabled(isStarted);
  }, [isStarted]);

  return (
    <Modal open={showModal} onClose={onClose}>
      <div>
        {showModal && <div className={styles.modalOverlay} onClick={onClose} />}
        <Box className={`${styles.modalContainer} ${animateIn ? styles.open : ""}`}>
          <button className={styles.closeIcon} onClick={onClose}>&times;</button>
          <div className={styles.modalHeader}>
            <img src="/tokenx-logo/t-transparent.png" width={40} height={40} alt="" />
            <h1 className={styles.modalHeaderTitle}>TOKENX</h1>
          </div>

          <h2 className={styles.modalTitle}>Settings</h2>

          <Box className={styles.autoBuyBox}>
            <h3 className={styles.autoBuyBoxTitle}>Auto Buy</h3>

            <TextField
              label="Buffer Amount (SOL)"
              type="number"
              size="small"
              value={bufferAmount}
              onChange={(e) => setBufferAmount(e.target.value)}
              inputProps={{ min: 0, step: "any" }}
              fullWidth
              variant="outlined"
              sx={{
                marginTop: "10px",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#2a2a2a",
                  borderRadius: 2,
                  color: "#fff",
                  fontWeight: 500,
                  "& fieldset": {
                    borderColor: "#555",
                  },
                  "&:hover fieldset": {
                    borderColor: "#888",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#ffd700",
                  },
                },
                "& .MuiInputLabel-root": {
                  color: "#bbb",
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#ffd700",
                },
              }}
            />

            <Button
              variant="contained"
              color={isStarted ? "success" : "error"}
              disabled={isButtonDisabled && !isStarted}
              onClick={() => setIsStarted((prev) => !prev)}
              fullWidth
              sx={{
                mt: 2, // margin-top
                "&.Mui-disabled": {
                  backgroundColor: "#555",
                  color: "#ccc",
                  opacity: 1,
                },
              }}
            >
              {isStarted ? "Started" : "Paused"}
            </Button>

          </Box>

          <Box className={styles.autoBuyBox}>
            <h3 className={styles.autoBuyBoxTitle}>Manual Buy</h3>

            <TextField
              label="Buy Amount (SOL)"
              type="number"
              size="small"
              value={manualBuyAmount}
              onChange={(e) => setManualBuyAmount(e.target.value)}
              inputProps={{ min: 0, step: "any" }}
              fullWidth
              variant="outlined"
              sx={{
                marginTop: "10px",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#2a2a2a",
                  borderRadius: 2,
                  color: "#fff",
                  fontWeight: 500,
                  "& fieldset": {
                    borderColor: "#555",
                  },
                  "&:hover fieldset": {
                    borderColor: "#888",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#ffd700",
                  },
                },
                "& .MuiInputLabel-root": {
                  color: "#bbb",
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#ffd700",
                },
              }}
            />



          </Box>
        </Box>
      </div>
    </Modal>
  );
};

export default HomeSetting;
