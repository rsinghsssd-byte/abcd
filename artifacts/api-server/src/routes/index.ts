import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import detectionsRouter from "./detections";
import statsRouter from "./stats";
import authRouter from "./auth";
import chatRouter from "./chat";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(detectionsRouter);
router.use(statsRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(usersRouter);

export default router;
