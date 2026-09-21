import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { NotificationController } from "./notification.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", NotificationController.listMine);
router.get("/unread-count", NotificationController.unreadCount);
router.patch("/read-all", NotificationController.markAllRead);
router.patch("/:notificationId/read", NotificationController.markRead);

export const NotificationRoutes = router;
