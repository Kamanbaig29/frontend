import { Router } from 'express';
import {
  getWhitelistDevs,
  addWhitelistDev,
  removeWhitelistDev,
  getBlacklistDevs,
  addBlacklistDev,
  removeBlacklistDev,
  updateBuyFilter,
  getBuyFilters,
  getBuyFiltersByUserId,
  getBlockedTokens,
  addBlockedToken,
  removeBlockedToken,
  updateSellFilter,
  getSellFilters
} from '../controllers/userFilterController';
import { authenticateJWT } from '../middleware/authMiddleware';

const router = Router();

router.get('/buy-filters-by-user-id', getBuyFiltersByUserId);
// Protect all filter routes with JWT authentication
router.use(authenticateJWT);

// Whitelist routes
router.get('/whitelist-devs', getWhitelistDevs);
router.post('/whitelist-devs', addWhitelistDev);
router.delete('/whitelist-devs', removeWhitelistDev);

// Blacklist routes
router.get('/blacklist-devs', getBlacklistDevs);
router.post('/blacklist-devs', addBlacklistDev);
router.delete('/blacklist-devs', removeBlacklistDev);

// Blocked Tokens routes
router.get('/blocked-tokens', getBlockedTokens);
router.post('/blocked-tokens', addBlockedToken);
router.delete('/blocked-tokens', removeBlockedToken);

// Buy Filter routes
router.post('/buy-filter', updateBuyFilter);
// Sell Filter route
router.post('/sell-filter', updateSellFilter);
router.get('/sell-filters', getSellFilters);
// GET /buy-filters always returns maxMcap and maxBuyers as numbers (never NaN/undefined), for frontend safety
router.get('/buy-filters', getBuyFilters);
// GET /buy-filters-by-user-id?userId=... returns buyFilters for any userId (no auth, for debug/testing)

export default router;