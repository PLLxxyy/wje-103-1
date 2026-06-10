import { defineStore } from 'pinia';
import { groupBuyApi } from '@/api/groupbuy';
import type { ListQuery } from '@/types/api';
import type { CreateGroupBuyPayload, GroupBuy } from '@/types/groupbuy';
import type { GroupBuyStatus } from '@/types/enums';

type GroupBuyState = {
  list: GroupBuy[];
  current: GroupBuy | null;
  loading: boolean;
};

const normalizeGroupBuy = (gb: any): GroupBuy => ({
  ...gb,
  average_rating: Number(gb.average_rating) || 0,
  review_count: Number(gb.review_count) || 0
});

export const useGroupBuyStore = defineStore('groupBuy', {
  state: (): GroupBuyState => ({
    list: [],
    current: null,
    loading: false
  }),
  getters: {
    activeCount: (state) => state.list.filter((item) => item.status === 'recruiting').length
  },
  actions: {
    async fetchList(params?: ListQuery) {
      this.loading = true;
      try {
        const raw = await groupBuyApi.list(params);
        this.list = (raw as any[]).map(normalizeGroupBuy);
        return this.list;
      } finally {
        this.loading = false;
      }
    },
    async fetchDetail(id: string) {
      this.loading = true;
      try {
        const raw = await groupBuyApi.detail(id);
        this.current = normalizeGroupBuy(raw);
        return this.current;
      } finally {
        this.loading = false;
      }
    },
    async create(payload: CreateGroupBuyPayload) {
      const raw = await groupBuyApi.create(payload);
      const groupBuy = normalizeGroupBuy(raw);
      this.list = [groupBuy, ...this.list];
      this.current = groupBuy;
      return groupBuy;
    },
    async updateStatus(id: string, status: GroupBuyStatus) {
      const raw = await groupBuyApi.updateStatus(id, status);
      const groupBuy = normalizeGroupBuy(raw);
      this.current = this.current?.id === id ? groupBuy : this.current;
      this.list = this.list.map((item) => (item.id === id ? groupBuy : item));
      return groupBuy;
    }
  }
});
