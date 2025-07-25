// src/components/LandingPage.tsx
import { useState, useEffect, useRef } from "react";
import "../assets/theme.css";
import "../assets/landingPageCSS/timeline.css";
import {
  Button,
  Typography,
  Box,
  Container,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import "../assets/landingPageCSS/navbar.css";

// Theme colors - Professional trust-building gradient
const themeColors = {
  primary: "#1a237e", // Deep blue
  secondary: "#3f51b5", // Royal blue
  accent: "#00bcd4", // Cyan accent
  gold: "#ffc107", // Gold for premium feel
  dark: "#0a0e27", // Deep navy
  darkGrey: "#1a1a2e", // Dark blue-grey
  light: "#FFFFFF",
  glow: "#00e5ff", // Cyan glow
};

// Styled components
const GradientText = styled(Typography)(() => ({
  background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 50%, ${themeColors.accent} 100%)`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  textFillColor: "transparent",
  fontWeight: 700,
}));

const GradientButton = styled(Button)(() => ({
  background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 50%, ${themeColors.accent} 100%)`,
  color: "white",
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: "6px",
  "&:hover": {
    "&::before": {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '6px',
      pointerEvents: 'none',
    },
    position: 'relative',
  },
}));

const FeatureCard = styled(Box)(() => ({
  background: "rgba(20, 0, 30, 0.2)",
  borderRadius: "12px",
  padding: "20px",
  backdropFilter: "blur(15px)",
  border: `1px solid rgba(90, 0, 110, 0.2)`,
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
  },
}));

// Navbar component
const Navbar = ({ onEnterApp, onLogin, onSignup }: { onEnterApp: () => void; onLogin?: () => void; onSignup?: () => void }) => {
  return (
    <Box
      className="navbar-container"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        zIndex: 1000,
        background: "rgba(5, 5, 5, 0.7)",
        backdropFilter: "blur(15px)",
        borderBottom: `1px solid rgba(90, 0, 110, 0.2)`,
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.5)`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <img
          className="navbar-logo"
          src="/tokenx-logo/t-transparent.png"
          alt="TOKONX"
          style={{ height: "40px", marginRight: "10px" }}
        />
        <Typography
          className="navbar-title"
          variant="h5"
          sx={{
            fontWeight: 700,
            background: `linear-gradient(90deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          TOKONX
        </Typography>
      </Box>
      <Box>
        <Button
          variant="outlined"
          size="small"
          onClick={onLogin || onEnterApp}
          sx={{
            color: themeColors.light,
            borderColor: themeColors.secondary,
            marginRight: 2,
            backgroundColor: "rgba(63, 81, 181, 0.1)",
            "&:hover": {
              borderColor: themeColors.accent,
              backgroundColor: "rgba(63, 81, 181, 0.2)",
            },
          }}
        >
          Login
        </Button>
        <GradientButton size="small" onClick={onSignup || onEnterApp}>Sign Up</GradientButton>
      </Box>
    </Box>
  );
};

const LandingPage = ({ onEnterApp, hideNavbar, onLogin, onSignup }: { onEnterApp: () => void; hideNavbar?: boolean; onLogin?: () => void; onSignup?: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const [sparkPosition, setSparkPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate loading - infinite for testing
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle scroll animation for timeline
  useEffect(() => {
    if (loading) return;
    
    const handleScroll = () => {
      if (!timelineRef.current) return;
      
      const timelineContainer = timelineRef.current;
      const containerRect = timelineContainer.getBoundingClientRect();
      const timelineItems = timelineContainer.querySelectorAll('.timeline-item');
      const newVisibleItems: number[] = [];
      
      // Calculate spark position - keep it at center of screen
      const viewportCenter = window.innerHeight / 2;
      const containerTop = containerRect.top;
      const containerBottom = containerRect.bottom;
      
      // Only show spark when timeline is visible on screen
      if (containerTop <= viewportCenter && containerBottom >= viewportCenter) {
        setSparkPosition(viewportCenter - containerTop);
      } else {
        setSparkPosition(-100); // Hide spark when timeline not in view
      }
      
      timelineItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const isVisible = rect.top <= window.innerHeight * 0.8;
        
        if (isVisible) {
          newVisibleItems.push(index);
        }
      });
      
      setVisibleItems(newVisibleItems);
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]);

  if (loading) {
    return (
      <Box
        sx={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: themeColors.dark,
        }}
      >
        <Box
          sx={{
            animation: 'fadeInOut 1.5s ease-in-out infinite',
            '@keyframes fadeInOut': {
              '0%': { opacity: 0.3 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.3 }
            }
          }}
        >
          <img 
            src="/tokenx-logo/t-transparent.png" 
            alt="TOKONX Loading" 
            style={{ height: '200px', width: 'auto' }} 
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        maxWidth: "100%",
        background: themeColors.dark,
        backgroundImage: `radial-gradient(circle at 50% 0%, rgba(26, 35, 126, 0.3), transparent 60%), radial-gradient(circle at 80% 20%, rgba(0, 188, 212, 0.2), transparent 40%), radial-gradient(circle at 20% 80%, rgba(255, 193, 7, 0.1), transparent 50%)`,
        color: themeColors.light,
        overflow: loading ? "hidden" : "auto",
        margin: 0,
        padding: 0,
        paddingTop: "0px", // Remove padding to prevent grey bar
      }}
    >
      {!loading && !hideNavbar && <Navbar onEnterApp={onEnterApp} onLogin={onLogin} onSignup={onSignup} />}
      <Container
        maxWidth={false}
        sx={{ width: "100%", px: { xs: 2, sm: 3, md: 4, lg: 5 } }}
      >
        {/* Hero Section */}
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            position: "relative",
          }}
        >
          <Box sx={{ zIndex: 2 }}>
            <GradientText
              variant="h1"
              sx={{ fontSize: { xs: "2.5rem", md: "4rem" }, mb: 2 }}
            >
              Your Edge in the Memecoin Game
            </GradientText>
            <Typography
              variant="h5"
              sx={{
                mb: 4,
                color: "rgba(255,255,255,0.7)",
                maxWidth: "800px",
                mx: "auto",
              }}
            >
              TOKONX brings automation, speed, and strategy together for smarter
              Solana trading
            </Typography>
            <GradientButton size="small" onClick={onSignup || onEnterApp}>
              Launch App
            </GradientButton>
          </Box>

          {/* Animated background elements */}
          <Box
            sx={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0.4,
              zIndex: 1,
            }}
          >
            {[...Array(5)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  position: "absolute",
                  width: Math.random() * 200 + 50,
                  height: Math.random() * 200 + 50,
                  borderRadius: "50%",
                  background:
                    i % 2 ? `rgba(90, 0, 110, 0.15)` : `rgba(153, 0, 204, 0.1)`,
                  filter: "blur(100px)",
                  boxShadow: "0 0 40px rgba(0, 0, 0, 0.2)",
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `float ${
                    Math.random() * 10 + 10
                  }s infinite ease-in-out`,
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Features Section */}
        <Box sx={{ py: 8 }}>
          <Typography variant="h3" sx={{ textAlign: "center", mb: 6 }}>
            Key{" "}
            <GradientText
              // component="span"
              sx={{ fontSize: "inherit", fontWeight: "inherit" }}
            >
              Features
            </GradientText>
          </Typography>
          
          <Box className="timeline-container" ref={timelineRef} sx={{ position: 'relative', my: 8 }}>
            {/* Timeline vertical line */}
            <Box className="timeline-line"></Box>
            
            {/* Timeline spark */}
            {sparkPosition > 0 && (
              <Box 
                className="timeline-spark"
                sx={{ top: `${sparkPosition}px` }}
              >
                <img 
                  src="/tokenx-logo/t-transparent.png" 
                  alt="TOKONX Logo" 
                />
              </Box>
            )}
            
            {/* Timeline items */}
            {[
              {
                title: "Real-Time Token Detection",
                description:
                  "Catch new token launches on the Solana blockchain the moment they happen with millisecond-level precision and zero delay.",
              },
              {
                title: "Intelligent Filtering Engine",
                description:
                  "Automatically filter tokens by market cap, buy volume, token age, developer history, LP lock status, and other key metrics all in real-time.",
              },
              {
                title: "Fully Automated Trading",
                description:
                  "Execute auto-buy and auto-sell strategies with configurable take-profit, stop-loss, and trailing stop mechanisms no manual intervention needed.",
              },
              {
                title: "Secure Wallet Integration",
                description:
                  "Connect your Solana wallet safely using secure transaction signing, without compromising your private keys or assets.",
              },
              {
                title: "Manual Sniping Support",
                description:
                  "Want full control? Snipe specific token mints manually via a streamlined interface perfect for power users and alpha hunters.",
              },
              {
                title: "Live Token Analytics",
                description:
                  "View real-time charts, price action, buyer trends, and liquidity changes all from within the TOKONX dashboard.",
              },
            ].map((feature, index) => (
              <Box 
                key={index} 
                className={`timeline-item ${visibleItems.includes(index) ? 'visible' : ''}`}
              >
                {/* Timeline ball */}
                <Box 
                  className={`timeline-ball ${sparkPosition >= (index * 108 + 24) ? 'filled' : ''}`}
                ></Box>
                
                {/* Timeline content */}
                <Box className="timeline-content">
                  <FeatureCard>
                    <Typography
                      variant="h6"
                      sx={{ mb: 2, color: themeColors.primary }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {feature.description}
                    </Typography>
                  </FeatureCard>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* CTA Section */}
        <Box sx={{ py: 8, textAlign: "center" }}>
          <GradientText variant="h3" sx={{ mb: 3 }}>
            Ready to start sniping?
          </GradientText>
          <Typography
            variant="body1"
            sx={{ mb: 4, color: "rgba(255,255,255,0.7)" }}
          >
            Join thousands of smart traders using TOKONX to discover hidden gems on Solana before the crowd.
          </Typography>
          <GradientButton size="small" onClick={onLogin || onEnterApp}>
            Enter Dashboard
          </GradientButton>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            py: 4,
            borderTop: `1px solid rgba(26, 35, 126, 0.2)`,
          }}
        >
          {/* Desktop Layout */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <img 
                src="/tokenx-logo/t-transparent.png" 
                alt="TOKONX" 
                style={{ height: '30px' }} 
              />
              <Typography variant="h6" sx={{ color: themeColors.light, fontWeight: 600 }}>
                TOKONX
              </Typography>
              <Typography variant="body2" sx={{ color: themeColors.secondary }}>
                © {new Date().getFullYear()} All rights reserved.
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button 
                variant="text" 
                size="small"
                sx={{ 
                  color: themeColors.primary,
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(90, 0, 110, 0.1)',
                    color: themeColors.secondary,
                    transform: 'scale(1.05)'
                  }
                }}
              >
                Contact
              </Button>
              <Button 
                variant="text" 
                size="small"
                sx={{ 
                  color: themeColors.primary,
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(90, 0, 110, 0.1)',
                    color: themeColors.secondary,
                    transform: 'scale(1.05)'
                  }
                }}
              >
                Docs
              </Button>
              
              <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
                <Box 
                  component="a" 
                  href="https://twitter.com" 
                  target="_blank" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(90, 0, 110, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(90, 0, 110, 0.2)',
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img 
                    src="/footerIcon/x.svg" 
                    alt="X (Twitter)" 
                    style={{ width: '20px', height: '20px' }} 
                  />
                </Box>
                <Box 
                  component="a" 
                  href="https://discord.com" 
                  target="_blank" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(90, 0, 110, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(90, 0, 110, 0.2)',
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img 
                    src="/footerIcon/discord.svg" 
                    alt="Discord" 
                    style={{ width: '20px', height: '20px' }} 
                  />
                </Box>
              </Box>
            </Box>
          </Box>
          
          {/* Mobile Layout */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {/* Row 1: Logo and TOKONX */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <img 
                src="/tokenx-logo/t-transparent.png" 
                alt="TOKONX" 
                style={{ height: '30px' }} 
              />
              <Typography variant="h6" sx={{ color: themeColors.light, fontWeight: 600 }}>
                TOKONX
              </Typography>
            </Box>
            
            {/* Row 2: Buttons on left, Icons on right */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="text" 
                  size="small"
                  sx={{ 
                    color: themeColors.primary,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(90, 0, 110, 0.1)',
                      color: themeColors.secondary,
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  Contact
                </Button>
                <Button 
                  variant="text" 
                  size="small"
                  sx={{ 
                    color: themeColors.primary,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(90, 0, 110, 0.1)',
                      color: themeColors.secondary,
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  Docs
                </Button>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box 
                  component="a" 
                  href="https://twitter.com" 
                  target="_blank" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(26, 35, 126, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(26, 35, 126, 0.2)',
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img 
                    src="/footerIcon/x.svg" 
                    alt="X (Twitter)" 
                    style={{ width: '20px', height: '20px' }} 
                  />
                </Box>
                <Box 
                  component="a" 
                  href="https://discord.com" 
                  target="_blank" 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(26, 35, 126, 0.1)',
                    '&:hover': {
                      backgroundColor: 'rgba(26, 35, 126, 0.2)',
                      transform: 'scale(1.1)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img 
                    src="/footerIcon/discord.svg" 
                    alt="Discord" 
                    style={{ width: '20px', height: '20px' }} 
                  />
                </Box>
              </Box>
            </Box>
            
            {/* Row 3: Copyright centered */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: themeColors.secondary }}>
                © {new Date().getFullYear()} All rights reserved.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
