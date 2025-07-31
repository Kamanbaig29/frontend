import express, { Router, Request, Response } from "express";
import SectionModalFilters, { ISectionModalFilters, IFilterItem } from "../models/sectionHome";

// Extend model interface with index signature
interface SectionModalFiltersDocument extends ISectionModalFilters {
  [key: string]: IFilterItem[] | any; // Allow string indexing
  firstDrops: IFilterItem[];
  heatingUp: IFilterItem[];
  battleTested: IFilterItem[];
}

const router: Router = express.Router();

// GET endpoint to fetch saved filters
router.get("/:userId", async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { sectionKey } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const doc = await SectionModalFilters.findOne({ userId }) as SectionModalFiltersDocument | null;
    
    if (!doc) {
      return res.json({ filters: null });
    }

    // If sectionKey is provided, return only that section's filters
    if (sectionKey && typeof sectionKey === 'string') {
      const validSections = ["firstDrops", "heatingUp", "battleTested"];
      if (!validSections.includes(sectionKey)) {
        return res.status(400).json({ error: "Invalid sectionKey" });
      }
      
      return res.json({ 
        filters: { 
          [sectionKey]: doc[sectionKey] || [] 
        } 
      });
    }

    // Return all filters
    return res.json({ 
      filters: {
        firstDrops: doc.firstDrops || [],
        heatingUp: doc.heatingUp || [],
        battleTested: doc.battleTested || []
      }
    });
  } catch (err) {
    console.error("Error fetching filters:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/upsert", async (req: Request, res: Response): Promise<Response> => {
  const { userId, sectionKey, filter } = req.body;
  if (!userId || !sectionKey || !filter || typeof sectionKey !== "string") {
    return res.status(400).json({ error: "Missing or invalid required fields" });
  }

  const validSections = ["firstDrops", "heatingUp", "battleTested"];
  if (!validSections.includes(sectionKey)) {
    return res.status(400).json({ error: "Invalid sectionKey" });
  }

  try {
    let doc = (await SectionModalFilters.findOne({ userId })) as SectionModalFiltersDocument | null;
    if (!doc) {
      doc = new SectionModalFilters({ userId }) as SectionModalFiltersDocument;
    }

    doc[sectionKey] = (doc[sectionKey] || []).filter((f: IFilterItem) => f.sectionTitle !== filter.sectionTitle);
    doc[sectionKey].push(filter);
    await doc.save();
    return res.json({ success: true, filters: doc });
  } catch (err) {
    console.error("Error in section filter upsert:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;