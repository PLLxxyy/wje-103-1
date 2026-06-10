import type { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { created, success } from '../utils/response';

export const reviewController = {
  async create(req: Request, res: Response) {
    const review = await reviewService.create(req.body, req.user!.id);
    created(res, review, '评价已提交');
  },

  async listByGroupBuy(req: Request, res: Response) {
    const reviews = await reviewService.listByGroupBuy(String(req.params.groupBuyId));
    success(res, reviews);
  },

  async groupBuyRating(req: Request, res: Response) {
    const rating = await reviewService.getGroupBuyRating(String(req.params.groupBuyId));
    success(res, rating);
  },

  async shopRating(req: Request, res: Response) {
    const rating = await reviewService.getShopRating(String(req.params.shopId));
    success(res, rating);
  }
};
