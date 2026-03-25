import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import companiesRouter from "./companies.js";
import autoDiscoverRouter from "./auto-discover.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/companies/auto-discover", autoDiscoverRouter);
router.use("/companies", companiesRouter);

export default router;
