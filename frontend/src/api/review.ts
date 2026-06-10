import { request } from '@/utils/request';
import type { RatingSummary, Review, ReviewPayload } from '@/types/review';

export const reviewApi = {
  create(data: ReviewPayload) {
    return request.post<Review>('/reviews', data);
  },
  listByGroupBuy(groupBuyId: string) {
    return request.get<Review[]>(`/reviews/groupbuy/${groupBuyId}`);
  },
  getGroupBuyRating(groupBuyId: string) {
    return request.get<RatingSummary>(`/reviews/groupbuy/${groupBuyId}/rating`);
  },
  getShopRating(shopId: string) {
    return request.get<RatingSummary>(`/reviews/shop/${shopId}/rating`);
  }
};
