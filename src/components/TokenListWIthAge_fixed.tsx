// Replace all hardcoded values in Heating-Up and Battle-Tested sections

// Line 1: Market Cap in Heating-Up section (around line 1800)
$1.2M → {token.marketCap ? `$${(token.marketCap / 1000000).toFixed(1)}M` : '$0'}

// Line 2: Volume in Heating-Up section
$256K → {token.volume ? `$${(token.volume / 1000).toFixed(0)}K` : '$0'}

// Line 3: Transactions in Heating-Up section  
3.4K → {token.buys && token.sells ? `${((token.buys + token.sells) / 1000).toFixed(1)}K` : '0'}

// Line 4: Holders in Heating-Up section
432 → {token.holders || 0}

// Line 5: Buys in Heating-Up section
91 → {token.buys || 0}

// Line 6: Sells in Heating-Up section
14 → {token.sells || 0}

// Line 7: Bonding Curve in Heating-Up section
3% → {token.bondingCurveProgress ? `${token.bondingCurveProgress.toFixed(1)}%` : '0%'}

// Same changes needed for Battle-Tested section (around line 2100)