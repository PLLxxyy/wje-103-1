import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authMiddleware } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', authMiddleware, asyncHandler(reviewController.create));
router.get('/groupbuy/:groupBuyId', asyncHandler(reviewController.listByGroupBuy));
router.get('/groupbuy/:groupBuyId/rating', asyncHandler(reviewController.groupBuyRating));
router.get('/shop/:shopId/rating', asyncHandler(reviewController.shopRating));

export default router;
