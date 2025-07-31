import React, { useState, useEffect } from "react";
import { TextField } from "@mui/material";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import styles from '../assets/SectionFilters.module.css';

interface SectionFiltersProps {
  sortOrder: string;
  setSortOrder: (order: string) => void;
  sectionTitle?: string;
  userId: string;
  onFiltersApplied?: (filters: any) => void;
}

const filterFields = [
  "B.curve%",
  "Dev Holding%",
  "Holders",
  "Liquidity",
  "Volume",
  "Market Cap",
  "Txns",
  "Buys",
  "Sells",
];

const SectionFilters: React.FC<SectionFiltersProps> = ({
  sortOrder,
  setSortOrder,
  sectionTitle = "",
  userId,
  onFiltersApplied,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, { min: string; max: string }>>(
    Object.fromEntries(filterFields.map((key) => [key, { min: "", max: "" }]))
  );
  const [loading, setLoading] = useState(false);
  const [skeletonLoading, setSkeletonLoading] = useState(false);

  // Load saved filters when modal opens
  useEffect(() => {
    if (modalOpen && userId) {
      setSkeletonLoading(true);
      loadSavedFilters();
    }
  }, [modalOpen, userId, sectionTitle]);

  const loadSavedFilters = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const sectionKey =
        sectionTitle === "Fresh-Drops"
          ? "firstDrops"
          : sectionTitle === "Heating-Up"
            ? "heatingUp"
            : sectionTitle === "Battle-Tested"
              ? "battleTested"
              : "";

      if (!sectionKey) return;

      const response = await fetch(`${API_URL}/api/section-filters/${userId}?sectionKey=${sectionKey}`);
      if (response.ok) {
        const data = await response.json();
        if (data.filters && data.filters[sectionKey] && data.filters[sectionKey].length > 0) {
          const savedFilter = data.filters[sectionKey].find((f: any) => f.sectionTitle === sectionTitle);
          if (savedFilter && savedFilter.filters) {
            setFilters(savedFilter.filters);
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    } finally {
      setLoading(false);
      // Add a small delay to show skeleton for at least 1 second
      setTimeout(() => {
        setSkeletonLoading(false);
      }, 500);
    }
  };

  const handleInputChange = (
    field: string,
    type: "min" | "max",
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [type]: value,
      },
    }));
  };

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_BASE_URL;
      const sectionKey =
        sectionTitle === "Fresh-Drops"
          ? "firstDrops"
          : sectionTitle === "Heating-Up"
            ? "heatingUp"
            : sectionTitle === "Battle-Tested"
              ? "battleTested"
              : "";

      if (!sectionKey) return;

      const response = await fetch(`${API_URL}/api/section-filters/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sectionKey,
          filter: {
            sectionTitle,
            sortOrder,
            filters,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Filters saved successfully:", result);
        
        // Real-time update: reload filters to show latest data
        await loadSavedFilters();
        
        if (onFiltersApplied) onFiltersApplied(filters);
        setModalOpen(false);
      } else {
        console.error("Failed to save filters");
      }
    } catch (error) {
      console.error("Error applying filters:", error);
    } finally {
      setLoading(false);
    }
  };

  // Skeleton loading component
  const SkeletonLoader = () => (
    <div className={styles.skeletonContainer}>
      <div className={styles.skeletonButtonGroup}>
        <div className={styles.skeletonButton}></div>
        <div className={styles.skeletonButton}></div>
      </div>
      <div className={styles.skeletonDivider}></div>
      <div className={styles.skeletonFilterSection}>
        <div className={styles.skeletonTitle}></div>
        <div className={styles.skeletonDivider}></div>
        <div className={styles.skeletonFilterContainer}>
          {filterFields.map((_, index) => (
            <div key={index} className={styles.skeletonFilterRow}>
              <div className={styles.skeletonFieldLabel}></div>
              <div className={styles.skeletonInputGroup}>
                <div className={styles.skeletonInput}></div>
                <div className={styles.skeletonInput}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.skeletonDivider}></div>
      <div className={styles.skeletonApplyButton}></div>
    </div>
  );

  return (
    <>
      <button
        className={styles.filterButton}
        onClick={() => setModalOpen(true)}
      >
        <img
          src="./homePageIcons/filterSection.svg"
          alt="Section Filter"
          className={styles.filterIcon}
        />
      </button>

      {modalOpen && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setModalOpen(false)}></div>
          <div className={styles.sectionModal}>
            <div className={styles.modalHeader}>
              <h3>{sectionTitle || "Tokens"}</h3>
              <button className={styles.closeButton} onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalContent}>
              {skeletonLoading ? (
                <SkeletonLoader />
              ) : (
                <>
                  {loading && (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#FFD700' }}>
                      Loading...
                    </div>
                  )}
                  
                  <div className={styles.buttonGroup}>
                    <button
                      className={`${styles.sortButton} ${sortOrder === 'desc' ? styles.activeSort : ''}`}
                      onClick={() => {
                        setSortOrder("desc");
                      }}
                    >
                      <FaSortAmountDown className={styles.sortIcon} />
                      Newest
                    </button>

                    <button
                      className={`${styles.sortButton} ${sortOrder === 'asc' ? styles.activeSort : ''}`}
                      onClick={() => {
                        setSortOrder("asc");
                      }}
                    >
                      <FaSortAmountUp className={styles.sortIcon} />
                      Oldest
                    </button>
                  </div>

                  <div className={styles.divider}></div>

                  <div className={styles.filterSection}>
                    <h4 className={styles.filterTitle}>Filters</h4>
                    <div className={styles.divider}></div>
                    <div className={styles.filterContainer}>
                      {filterFields.map((field) => (
                        <div key={field} className={styles.filterRow}>
                          <span className={styles.fieldLabel}>{field}</span>
                          <div className={styles.inputGroup}>
                            <TextField
                              placeholder="Min"
                              type="number"
                              size="small"
                              value={filters[field].min}
                              onChange={(e) => handleInputChange(field, "min", e.target.value)}
                              variant="outlined"
                              inputProps={{ min: 0 }}
                              className={styles.filterInput}
                              fullWidth
                              disabled={loading}
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                  borderRadius: "4px",
                                  color: "white",
                                  transition: "all 0.3s ease",
                                },
                                "& input": {
                                  color: "white",
                                  fontSize: "12px",
                                  padding: "8px 10px",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "rgba(63, 81, 181, 0.3)",
                                },
                                "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                                  boxShadow: "0 0 4px rgba(63, 81, 181, 0.8)",
                                  border: "1px solid rgba(63, 81, 181, 0.8)",
                                }
                              }}
                            />
                            <TextField
                              placeholder="Max"
                              type="number"
                              size="small"
                              value={filters[field].max}
                              onChange={(e) => handleInputChange(field, "max", e.target.value)}
                              variant="outlined"
                              inputProps={{ min: 0 }}
                              className={styles.filterInput}
                              fullWidth
                              disabled={loading}
                              sx={{
                                 "& .MuiOutlinedInput-root": {
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                  borderRadius: "4px",
                                  color: "white",
                                  transition: "all 0.3s ease",
                                },
                                "& input": {
                                  color: "white",
                                  fontSize: "12px",
                                  padding: "8px 10px",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "rgba(63, 81, 181, 0.3)",
                                },
                                "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                                  boxShadow: "0 0 4px rgba(63, 81, 181, 0.8)",
                                  border: "1px solid rgba(63, 81, 181, 0.8)",
                                },
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.divider}></div>

                  <button
                    className={styles.applyButton}
                    onClick={handleApplyFilters}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Apply Filters"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SectionFilters;