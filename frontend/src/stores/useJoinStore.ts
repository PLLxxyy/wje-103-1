import { defineStore } from 'pinia';
import { joinApi } from '@/api/join';
import type { JoinPayload, JoinRecord, JoinSummary } from '@/types/join';
import type { GroupBuy } from '@/types/groupbuy';

type JoinState = {
  myJoins: JoinRecord[];
  manageRecords: JoinRecord[];
  summary: JoinSummary | null;
  loading: boolean;
};

const normalizeGroupBuy = (gb: any): GroupBuy => ({
  ...gb,
  average_rating: Number(gb?.average_rating) || 0,
  review_count: Number(gb?.review_count) || 0
});

const normalizeJoinRecord = (record: any): JoinRecord => ({
  ...record,
  groupBuy: record.groupBuy ? normalizeGroupBuy(record.groupBuy) : undefined
});

export const useJoinStore = defineStore('join', {
  state: (): JoinState => ({
    myJoins: [],
    manageRecords: [],
    summary: null,
    loading: false
  }),
  actions: {
    async create(payload: JoinPayload) {
      const raw = await joinApi.create(payload);
      const record = normalizeJoinRecord(raw);
      this.myJoins = [record, ...this.myJoins];
      return record;
    },
    async fetchMyJoins() {
      this.loading = true;
      try {
        const raw = await joinApi.myJoins();
        this.myJoins = (raw as any[]).map(normalizeJoinRecord);
        return this.myJoins;
      } finally {
        this.loading = false;
      }
    },
    async fetchManage(groupBuyId?: string) {
      this.loading = true;
      try {
        const data = await joinApi.manage(groupBuyId);
        this.manageRecords = (data.records as any[]).map(normalizeJoinRecord);
        this.summary = data.summary;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async markPicked(id: string, pickedUp: boolean) {
      const raw = await joinApi.markPicked(id, pickedUp);
      const record = normalizeJoinRecord(raw);
      this.manageRecords = this.manageRecords.map((item) => (item.id === id ? record : item));
      this.myJoins = this.myJoins.map((item) => (item.id === id ? record : item));
      return record;
    }
  }
});
