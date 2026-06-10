import { defineStore } from 'pinia';
import { shopApi } from '@/api/shop';
import type { DessertItem, Shop } from '@/types/shop';
import type { GroupBuy } from '@/types/groupbuy';

type ShopState = {
  list: Shop[];
  current: Shop | null;
  desserts: DessertItem[];
  loading: boolean;
};

const normalizeGroupBuy = (gb: any): GroupBuy => ({
  ...gb,
  average_rating: Number(gb.average_rating) || 0,
  review_count: Number(gb.review_count) || 0
});

const normalizeShop = (shop: any): Shop => ({
  ...shop,
  average_rating: Number(shop.average_rating) || 0,
  review_count: Number(shop.review_count) || 0,
  groupBuys: (shop.groupBuys || []).map(normalizeGroupBuy)
});

export const useShopStore = defineStore('shop', {
  state: (): ShopState => ({
    list: [],
    current: null,
    desserts: [],
    loading: false
  }),
  actions: {
    async fetchList() {
      this.loading = true;
      try {
        const raw = await shopApi.list();
        this.list = (raw as any[]).map(normalizeShop);
        return this.list;
      } finally {
        this.loading = false;
      }
    },
    async fetchDetail(id: string) {
      this.loading = true;
      try {
        const raw = await shopApi.detail(id);
        this.current = normalizeShop(raw);
        this.desserts = this.current.dessertItems ?? [];
        return this.current;
      } finally {
        this.loading = false;
      }
    },
    async fetchDesserts(id: string) {
      this.desserts = await shopApi.desserts(id);
      return this.desserts;
    }
  }
});
