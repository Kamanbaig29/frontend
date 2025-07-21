import { Request, Response } from 'express';
import UserFilterPreset from '../models/UserFilterPreset';
import User from '../models/user_auth';

// Helper to get userId from req
function getUserId(req: Request): string | undefined {
  return (req as any).user?.id;
}

export const getWhitelistDevs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const preset = await UserFilterPreset.findOne({ userId });
    if (!preset) {
      res.json({ whitelistDevs: ['true'] });
      return;
    }
    
    res.json({ whitelistDevs: preset.buyFilters.whitelistDevs || ['true'] });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch whitelist devs' });
  }
};

export const addWhitelistDev = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { address } = req.body;
    
    if (!userId || !address) {
      res.status(400).json({ message: 'Missing userId or address' });
      return;
    }
    
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { $addToSet: { 'buyFilters.whitelistDevs': address } },
      { new: true, upsert: true }
    );
    
    res.json({ whitelistDevs: preset.buyFilters.whitelistDevs });
  } catch (e) {
    res.status(500).json({ message: 'Failed to add whitelist dev' });
  }
};

export const removeWhitelistDev = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { address } = req.body;
    
    if (!userId || !address) {
      res.status(400).json({ message: 'Missing userId or address' });
      return;
    }
    
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { $pull: { 'buyFilters.whitelistDevs': address } },
      { new: true }
    );

    let finalWhitelist = ['true'];
    if (preset && preset.buyFilters.whitelistDevs && preset.buyFilters.whitelistDevs.length > 0) {
      finalWhitelist = preset.buyFilters.whitelistDevs;
    } else if (preset) {
      preset.buyFilters.whitelistDevs = ['true'];
      await preset.save();
    }
    
    res.json({ whitelistDevs: finalWhitelist });
  } catch (e) {
    res.status(500).json({ message: 'Failed to remove whitelist dev' });
  }
};

// --- Fixed Blacklist Devs Handlers ---
export const getBlacklistDevs = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      
      const preset = await UserFilterPreset.findOne({ userId });
      if (!preset) {
        res.json({ blacklistDevs: [] });
        return;
      }
      
      res.json({ blacklistDevs: preset.buyFilters.blacklistDevs || [] });
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch blacklist devs' });
    }
  };
  
  export const addBlacklistDev = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { address } = req.body;
      
      if (!userId || !address) {
        res.status(400).json({ message: 'Missing userId or address' });
        return;
      }
      
      const preset = await UserFilterPreset.findOneAndUpdate(
        { userId },
        { $addToSet: { 'buyFilters.blacklistDevs': address } },
        { new: true, upsert: true }
      );
      
      res.json({ blacklistDevs: preset.buyFilters.blacklistDevs });
    } catch (e) {
      res.status(500).json({ message: 'Failed to add blacklist dev' });
    }
  };
  
  export const removeBlacklistDev = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { address } = req.body;
      
      if (!userId || !address) {
        res.status(400).json({ message: 'Missing userId or address' });
        return;
      }
      
      const preset = await UserFilterPreset.findOneAndUpdate(
        { userId },
        { $pull: { 'buyFilters.blacklistDevs': address } },
        { new: true }
      );
      
      res.json({ blacklistDevs: preset?.buyFilters.blacklistDevs || [] });
    } catch (e) {
      res.status(500).json({ message: 'Failed to remove blacklist dev' });
    }
  };

// --- Blocked Tokens ---
export const getBlockedTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const preset = await UserFilterPreset.findOne({ userId });
    res.json({ blockedTokens: preset?.sellFilters?.blockedTokens || [] });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch blocked tokens' });
  }
};

export const addBlockedToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { address } = req.body;
    
    if (!userId || !address) {
      res.status(400).json({ message: 'Missing userId or address' });
      return;
    }
    
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { 
        $addToSet: { 'sellFilters.blockedTokens': address }
      },
      { 
        new: true, 
        upsert: true,
      }
    );
    
    res.json({ blockedTokens: preset?.sellFilters?.blockedTokens || [] });
  } catch (e) {    
    console.error('Error in addBlockedToken:', e);
    res.status(500).json({ message: 'Failed to add blocked token' });
  }
};

export const removeBlockedToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req); // Correctly get userId
    const { address } = req.body;
    
    if (!userId || !address) {
      res.status(400).json({ message: 'Missing userId or address' });
      return;
    }
    
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { $pull: { 'sellFilters.blockedTokens': address } },
      { new: true }
    );
    
    res.json({ blockedTokens: preset?.sellFilters?.blockedTokens || [] });
  } catch (e) {
    res.status(500).json({ message: 'Failed to remove blocked token' });
  }
};

export const updateBuyFilter = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { field, value } = req.body;
    if (!userId || !field) {
      res.status(400).json({ message: 'Missing userId or field' });
      return;
    }
    const allowedFields = [
      'maxMcap', 'maxBuyers', 'maxTokenAge', 'antiRug', 'minLpLockTime',
      'whitelistDevs', 'blacklistDevs', 'autoSellCondition', 'noBribeMode', 'timeout',
      'buyUntilReached', 'buyUntilMarketCap', 'buyUntilPrice', 'buyUntilAmount'
    ];
    if (!allowedFields.includes(field)) {
      res.status(400).json({ message: 'Invalid field' });
      return;
    }
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { $set: { [`buyFilters.${field}`]: value } },
      { new: true, upsert: true }
    );
    res.json({ buyFilters: preset.buyFilters });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update buy filter' });
  }
};

export const getBuyFilters = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const preset = await UserFilterPreset.findOne({ userId });
    res.json({ buyFilters: preset?.buyFilters || {} });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch buy filters' });
  }
};

// New: Get buyFilters by userId (no auth, for debug/testing)
export const getBuyFiltersByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ message: 'Missing userId param' });
      return;
    }
    // Use .lean() to get a plain JS object
    const preset = await UserFilterPreset.findOne({ userId }).lean();
    const buyFilters = { ...(preset?.buyFilters || {}) };
    buyFilters.maxMcap = Number(buyFilters.maxMcap) || 0;
    buyFilters.maxBuyers = Number(buyFilters.maxBuyers) || 0;
    res.json({ buyFilters });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch buy filters by userId' });
  }
};

export const updateSellFilter = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { field, value } = req.body;
    if (!userId || !field) {
      res.status(400).json({ message: 'Missing userId or field' });
      return;
    }
    const allowedFields = [
      'minLiquidity', 'frontRunProtection', 'loopSellLogic', 'waitForBuyersBeforeSell', 'blockedTokens',
      'takeProfitPercent', 'stopLossPercent', 'trailingStopPercent', 'timeoutSellAfterSec', 'sellPercent'
    ];
    if (!allowedFields.includes(field)) {
      res.status(400).json({ message: 'Invalid field' });
      return;
    }
    const preset = await UserFilterPreset.findOneAndUpdate(
      { userId },
      { $set: { [`sellFilters.${field}`]: value } },
      { new: true, upsert: true }
    );
    res.json({ sellFilters: preset.sellFilters });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update sell filter' });
  }
};

export const getSellFilters = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const preset = await UserFilterPreset.findOne({ userId });
    res.json({ sellFilters: preset?.sellFilters || {} });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch sell filters' });
  }
};