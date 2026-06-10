import { defineStore } from 'pinia';
import { reviewApi } from '@/api/review';
import type { RatingSummary, Review, ReviewPayload } from '@/types/review';

type ReviewState = {
  groupBuyReviews: Review[];
  groupBuyRating: RatingSummary | null;
  shopRating: RatingSummary | null;
  loading: boolean;
};

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => ({
    groupBuyReviews: [],
    groupBuyRating: null,
    shopRating: null,
    loading: false
  }),
  actions: {
    async create(payload: ReviewPayload) {
      const review = await reviewApi.create(payload);
      return review;
    },
    async fetchGroupBuyReviews(groupBuyId: string) {
      this.loading = true;
      try {
        this.groupBuyReviews = await reviewApi.listByGroupBuy(groupBuyId);
        return this.groupBuyReviews;
      } finally {
        this.loading = false;
      }
    },
    async fetchGroupBuyRating(groupBuyId: string) {
      this.groupBuyRating = await reviewApi.getGroupBuyRating(groupBuyId);
      return this.groupBuyRating;
    },
    async fetchShopRating(shopId: string) {
      this.shopRating = await reviewApi.getShopRating(shopId);
      return this.shopRating;
    }
  }
});
