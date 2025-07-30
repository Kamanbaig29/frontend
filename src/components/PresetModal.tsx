import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/webSocketContext';
import styles from '../assets/PresetModal.module.css';

interface PresetModalProps {
  open: boolean;
  onClose: () => void;
  buyPresets: any[];
  sellPresets: any[];
  activeBuyPreset: number;
  activeSellPreset: number;
  setActiveBuyPreset: (idx: number) => void;
  setActiveSellPreset: (idx: number) => void;
}

// Define form state interface
interface FormState {
  autoFee: boolean;
  priorityFee: string;
  bribeAmount: string;
  maxFee: string;
  slippage: string;
  mevMode: string;
  rpcUrl: string;
  [key: string]: any; // For any additional properties
}

const PresetModal: React.FC<PresetModalProps> = ({
  open, onClose, buyPresets, sellPresets, activeBuyPreset, activeSellPreset,
  setActiveBuyPreset, setActiveSellPreset
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [form, setForm] = useState<FormState>({} as FormState);
  const { ws } = useWebSocket();
  const autoFeeSubscribed = useRef(false);
  const lastAutoFeeValue = useRef<boolean | null>(null);

  // Initialize lastAutoFeeValue on component mount
  useEffect(() => {
    // Set initial value based on current preset
    if (mode === 'buy' && buyPresets && buyPresets[activeBuyPreset]) {
      lastAutoFeeValue.current = !!buyPresets[activeBuyPreset].autoFee;
    } else if (mode === 'sell' && sellPresets && sellPresets[activeSellPreset]) {
      lastAutoFeeValue.current = !!sellPresets[activeSellPreset].autoFee;
    }
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (mode === 'buy' && buyPresets && buyPresets[activeBuyPreset]) {
      // Preserve autoFee value when switching presets
      setForm(() => ({ 
        ...buyPresets[activeBuyPreset],
        // Keep autoFee value if it was explicitly set before
        autoFee: lastAutoFeeValue.current !== null ? lastAutoFeeValue.current : buyPresets[activeBuyPreset].autoFee
      }));
    }
    if (mode === 'sell' && sellPresets && sellPresets[activeSellPreset]) {
      // Preserve autoFee value when switching presets
      setForm(() => ({ 
        ...sellPresets[activeSellPreset],
        // Keep autoFee value if it was explicitly set before
        autoFee: lastAutoFeeValue.current !== null ? lastAutoFeeValue.current : sellPresets[activeSellPreset].autoFee
      }));
    }
  }, [mode, activeBuyPreset, activeSellPreset, buyPresets, sellPresets]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Only update if autoFee is enabled and we have the data
        if (data.type === "AUTO_FEE_UPDATE" && form.autoFee) {
          setForm((prev: FormState) => {
            // Don't update if autoFee was turned off
            if (!prev.autoFee) return prev;
            
            return {
              ...prev,
              priorityFee: data.priorityFee,
              bribeAmount: data.bribeAmount,
              // Ensure autoFee stays enabled
              autoFee: true
            };
          });
        }
      } catch { }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, form.autoFee]);

  useEffect(() => {
    if (!ws) return;
    
    // Only update subscription if autoFee value has actually changed
    if (lastAutoFeeValue.current !== form.autoFee) {
      // Update our tracking ref
      lastAutoFeeValue.current = !!form.autoFee;
      
      // Subscribe if needed
      if (form.autoFee && !autoFeeSubscribed.current) {
        console.log('Subscribing to auto fee updates');
        ws.send(JSON.stringify({ type: "SUBSCRIBE_AUTO_FEE" }));
        autoFeeSubscribed.current = true;
      } 
      // Unsubscribe if needed
      else if (!form.autoFee && autoFeeSubscribed.current) {
        console.log('Unsubscribing from auto fee updates');
        ws.send(JSON.stringify({ type: "UNSUBSCRIBE_AUTO_FEE" }));
        autoFeeSubscribed.current = false;
      }
    }

    return () => {
      if (autoFeeSubscribed.current && ws) {
        ws.send(JSON.stringify({ type: "UNSUBSCRIBE_AUTO_FEE" }));
        autoFeeSubscribed.current = false;
      }
    };
  }, [form.autoFee, ws]);

  useEffect(() => {
    if (!ws) return;
    if (!form.autoFee) return;
    if (form.priorityFee && form.bribeAmount) {
      ws.send(JSON.stringify({
        type: "UPDATE_PRESET",
        mode,
        presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
        settings: {
          priorityFee: form.priorityFee,
          bribeAmount: form.bribeAmount,
        }
      }));
    }
  }, [form.priorityFee, form.bribeAmount, form.autoFee, ws, mode, activeBuyPreset, activeSellPreset]);

  const handlePresetChange = (newPreset: number) => {
    if (mode === 'buy') setActiveBuyPreset(newPreset);
    else setActiveSellPreset(newPreset);
    if (ws) {
      ws.send(JSON.stringify({ type: "APPLY_PRESET", mode, presetIndex: newPreset }));
      ws.send(JSON.stringify({ type: "GET_PRESETS" }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    
    // If autoFee checkbox is changed, update the ref
    if (name === 'autoFee') {
      lastAutoFeeValue.current = checked;
    }

    setForm((prev: FormState) => {
      const updatedForm = { ...prev, [name]: newValue };

      // Small delay for autoFee updates to prevent race conditions
      setTimeout(() => {
        if (ws) {
          ws.send(JSON.stringify({
            type: "UPDATE_PRESET",
            mode,
            presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
            settings: updatedForm
          }));
        }
      }, 50);

      return updatedForm;
    });
  };

  const handleMevModeChange = (value: string) => {
    if (!value) return;

    setForm((prev: FormState) => {
      const updatedForm = { ...prev, mevMode: value };

      if (ws) {
        ws.send(JSON.stringify({
          type: "UPDATE_PRESET",
          mode,
          presetIndex: mode === 'buy' ? activeBuyPreset : activeSellPreset,
          settings: updatedForm
        }));
      }

      return updatedForm;
    });
  };

  if (!open) return null;

  return (
    <div className={styles.presetBackdrop} onClick={onClose}>
      <div className={styles.presetModal} onClick={e => e.stopPropagation()}>
        <div className={styles.presetHeader}>
          <h3>Trading Presets</h3>
          <button className={styles.presetCloseButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.presetContent}>
          <div className={styles.presetToggleGroup}>
            {[0, 1, 2].map(index => (
              <button
                key={index}
                className={`${styles.presetToggleButton} ${(mode === 'buy' ? activeBuyPreset : activeSellPreset) === index
                  ? styles.presetToggleActive : ''
                  }`}
                onClick={() => handlePresetChange(index)}
              >
                PRESET {index + 1}
              </button>
            ))}
          </div>

          <div className={styles.presetModeToggle}>
            <button
              className={`${styles.modeToggleButton} ${mode === 'buy' ? styles.modeToggleActiveBuy : ''}`}
              onClick={() => setMode('buy')}
            >
              Buy Settings
            </button>
            <button
              className={`${styles.modeToggleButton} ${mode === 'sell' ? styles.modeToggleActiveSell : ''}`}
              onClick={() => setMode('sell')}
            >
              Sell Settings
            </button>
          </div>


          <div className={styles.presetPartitionLine}></div>

          <div className={styles.presetInputSection}>
            <div className={styles.presetInputRow}>
              <div className={styles.presetInputGroup}>
                <div className={styles.presetInputWrapper}>
                  <span className={styles.presetInputIcon}>⚡</span>
                  <input
                    className={styles.presetInputField}
                    name="slippage"
                    value={form.slippage || ""}
                    onChange={handleChange}
                    placeholder="Slippage"
                  />
                </div>
                <div className={styles.presetInputLabel}>SLIPPAGE</div>
              </div>

              <div className={styles.presetInputGroup}>
                <div className={styles.presetInputWrapper}>
                  <span className={styles.presetInputIcon}>🏷️</span>
                  <input
                    className={styles.presetInputField}
                    name="priorityFee"
                    value={form.priorityFee || ""}
                    onChange={handleChange}
                    disabled={!!form.autoFee}
                    placeholder="Priority"
                  />
                </div>
                <div className={styles.presetInputLabel}>PRIORITY</div>
              </div>

              <div className={styles.presetInputGroup}>
                <div className={styles.presetInputWrapper}>
                  <span className={styles.presetInputIcon}>💸</span>
                  <input
                    className={styles.presetInputField}
                    name="bribeAmount"
                    value={form.bribeAmount || ""}
                    onChange={handleChange}
                    disabled={!!form.autoFee}
                    placeholder="Bribe"
                  />
                </div>
                <div className={styles.presetInputLabel}>BRIBE</div>
              </div>
            </div>

            <div className={styles.presetAutoFeeSection}>
              <label className={styles.presetCheckboxContainer}>
                <input
                  type="checkbox"
                  checked={!!form.autoFee}
                  onChange={handleChange}
                  onClick={(e) => e.stopPropagation()}
                  name="autoFee"
                />
                <span className={styles.presetCheckmark}></span>
                Auto Fee
              </label>

              <div className={styles.presetMaxFeeWrapper}>
                <div className={styles.presetInputWrapper}>
                  <input
                    className={styles.presetInputField}
                    name="maxFee"
                    value={form.maxFee || ""}
                    onChange={handleChange}
                    disabled={!form.autoFee}
                    placeholder="Max Fee"
                  />
                </div>
                <div className={styles.presetInputLabel}>MAX FEE</div>
              </div>
            </div>
          </div>

          <div className={styles.presetPartitionLine}></div>

          <div className={styles.presetMevSection}>
            <div className={styles.presetSectionTitle}>MEV Mode</div>
            <div className={styles.presetMevButtons}>
              <button
                className={`${styles.presetMevButton} ${form.mevMode === 'off' ? styles.presetMevButtonActive : ''}`}
                onClick={() => handleMevModeChange('off')}
              >
                ⛔ Off
              </button>
              <button
                className={`${styles.presetMevButton} ${form.mevMode === 'reduced' ? styles.presetMevButtonActive : ''}`}
                onClick={() => handleMevModeChange('reduced')}
              >
                🛡️ Reduced
              </button>
              <button
                className={`${styles.presetMevButton} ${form.mevMode === 'secure' ? styles.presetMevButtonActive : ''}`}
                onClick={() => handleMevModeChange('secure')}
              >
                🛡️ Secure
              </button>
            </div>
          </div>

          <div className={styles.presetPartitionLine}></div>

          <div className={styles.presetRpcSection}>
            <div className={styles.presetInputWrapper}>
              <input
                className={styles.presetInputField}
                name="rpcUrl"
                value={form.rpcUrl || ""}
                onChange={handleChange}
                placeholder="RPC URL"
              />
            </div>
            <div className={styles.presetInputLabel}>RPC</div>
          </div>

          <button className={styles.presetContinueButton} onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresetModal;