<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { showSuccessToast } from 'vant';
import CountdownTimer from '@/components/common/CountdownTimer.vue';
import PickupPointTag from '@/components/common/PickupPointTag.vue';
import ReviewDialog from '@/components/common/ReviewDialog.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown } from '@/hooks/useCountdown';
import { useGroupBuyStore } from '@/stores/useGroupBuyStore';
import { useJoinStore } from '@/stores/useJoinStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useVoteStore } from '@/stores/useVoteStore';
import { GroupBuyStatus, UserRole, VoteStatus, groupBuyStatusText } from '@/types/enums';
import { formatDateTime, formatPrice, maskPhone } from '@/utils/format';
import type { JoinRecord } from '@/types/join';

const route = useRoute();
const auth = useAuth();
const groupBuyStore = useGroupBuyStore();
const joinStore = useJoinStore();
const voteStore = useVoteStore();
const reviewStore = useReviewStore();
const id = computed(() => String(route.params.id));
const detail = computed(() => groupBuyStore.current);
const deadline = computed(() => detail.value?.deadline ?? new Date().toISOString());
const countdown = useCountdown(deadline);

const reviewVisible = ref(false);
const reviewableJoin = ref<JoinRecord | null>(null);

const joinForm = reactive({
  flavor: '',
  quantity: 1,
  pickup_point_id: ''
});

const statusOptions = [
  GroupBuyStatus.RECRUITING,
  GroupBuyStatus.CLOSED,
  GroupBuyStatus.DELIVERING,
  GroupBuyStatus.COMPLETED,
  GroupBuyStatus.CANCELLED
];

const joinedQuantity = computed(() =>
  (detail.value?.joinRecords ?? []).reduce((sum, record) => sum + Number(record.quantity), 0)
);

const canManage = computed(() => {
  const user = auth.currentUser.value;
  if (!user || !detail.value) return false;
  return user.role === UserRole.ADMIN || detail.value.leader_id === user.id;
});

const votedOptionId = computed(() => {
  const userId = auth.currentUser.value?.id;
  if (!userId) return '';
  return (voteStore.result?.options ?? [])
    .find((option) => option.voteRecords?.some((record) => record.user_id === userId))
    ?.id ?? '';
});

const selectedPickup = computed(() =>
  detail.value?.pickupPoints?.find((point) => point.id === joinForm.pickup_point_id)
);

const myReviewableRecord = computed(() => {
  const userId = auth.currentUser.value?.id;
  if (!userId || !detail.value?.joinRecords) return null;
  return (
    detail.value.joinRecords.find(
      (r) => r.user_id === userId && r.picked_up && !r.review
    ) ?? null
  );
});

const reviews = computed(() => reviewStore.groupBuyReviews);

const refresh = async () => {
  await Promise.all([
    groupBuyStore.fetchDetail(id.value),
    voteStore.fetchResults(id.value),
    reviewStore.fetchGroupBuyReviews(id.value)
  ]);
};

const openReview = () => {
  if (myReviewableRecord.value) {
    reviewableJoin.value = myReviewableRecord.value;
    reviewVisible.value = true;
  }
};

const handleReviewSuccess = () => {
  refresh();
};

const submitJoin = async () => {
  if (!detail.value) return;
  await joinStore.create({
    group_buy_id: detail.value.id,
    flavor: joinForm.flavor,
    quantity: Number(joinForm.quantity),
    pickup_point_id: joinForm.pickup_point_id
  });
  showSuccessToast('接龙成功');
  joinForm.flavor = '';
  joinForm.quantity = 1;
  await refresh();
};

const vote = async (optionId: string) => {
  await voteStore.vote(optionId, id.value);
  showSuccessToast('投票成功');
};

const changeStatus = async (status: GroupBuyStatus) => {
  await groupBuyStore.updateStatus(id.value, status);
  showSuccessToast('状态已更新');
  await refresh();
};

watch(
  detail,
  (value) => {
    if (value?.pickupPoints?.length && !joinForm.pickup_point_id) {
      joinForm.pickup_point_id = value.pickupPoints[0].id;
    }
  },
  { immediate: true }
);

onMounted(refresh);
</script>

<template>
  <main v-if="detail" class="page detail-page">
    <section class="detail-hero">
      <div>
        <StatusBadge :status="detail.status" />
        <h1>{{ detail.title }}</h1>
        <p>{{ detail.shop?.name }} · 团长 {{ detail.leader?.nickname }}</p>
        <div v-if="detail.review_count > 0" class="hero-rating">
          <span class="stars">
            <i v-for="i in 5" :key="i" :class="{ filled: i <= Math.round(detail.average_rating) }">★</i>
          </span>
          <span class="score">{{ detail.average_rating.toFixed(1) }}</span>
          <span class="count">({{ detail.review_count }}条评价)</span>
        </div>
      </div>
      <div class="price-block">
        <strong>{{ formatPrice(detail.group_price) }}</strong>
        <span>{{ formatPrice(detail.original_price) }}</span>
      </div>
    </section>

    <section class="panel detail-summary">
      <div>
        <span>距截止</span>
        <CountdownTimer :deadline="detail.deadline" />
      </div>
      <div>
        <span>已接份数</span>
        <strong>{{ joinedQuantity }}/{{ detail.min_quantity }}</strong>
      </div>
      <div>
        <span>截止时间</span>
        <strong>{{ formatDateTime(detail.deadline) }}</strong>
      </div>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>团购说明</h2>
        <span class="muted">{{ countdown.expired.value ? '已截止' : '进行中' }}</span>
      </div>
      <p class="description">{{ detail.description }}</p>
      <p v-if="detail.pickup_notes" class="pickup-note">{{ detail.pickup_notes }}</p>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>提货点</h2>
        <span class="muted">{{ detail.pickupPoints?.length || 0 }} 个</span>
      </div>
      <div class="stack">
        <PickupPointTag
          v-for="point in detail.pickupPoints"
          :key="point.id"
          :point="point"
          :selected="point.id === joinForm.pickup_point_id"
        />
      </div>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>参与接龙</h2>
        <span class="muted">{{ selectedPickup?.available_time }}</span>
      </div>
      <form class="join-form" @submit.prevent="submitJoin">
        <van-field v-model="joinForm.flavor" label="口味" />
        <van-field label="数量">
          <template #input>
            <van-stepper v-model="joinForm.quantity" min="1" integer />
          </template>
        </van-field>
        <select v-model="joinForm.pickup_point_id" class="native-select" required>
          <option v-for="point in detail.pickupPoints" :key="point.id" :value="point.id">
            {{ point.address }} · {{ point.available_time }}
          </option>
        </select>
        <van-button
          block
          type="primary"
          native-type="submit"
          :disabled="detail.status !== GroupBuyStatus.RECRUITING"
        >
          加入接龙
        </van-button>
      </form>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>口味投票</h2>
        <span class="muted">{{ voteStore.result?.totalVotes || 0 }} 票</span>
      </div>
      <div class="stack">
        <button
          v-for="option in voteStore.result?.options"
          :key="option.id"
          type="button"
          class="vote-row"
          :class="{ voted: votedOptionId === option.id }"
          :disabled="voteStore.result?.status !== VoteStatus.OPEN || Boolean(votedOptionId)"
          @click="vote(option.id)"
        >
          <span>{{ option.option_text }}</span>
          <strong>{{ option.voteCount || 0 }}票 · {{ option.percent || 0 }}%</strong>
          <i :style="{ width: `${option.percent || 0}%` }" />
        </button>
        <p v-if="!voteStore.result?.options.length" class="empty-copy">暂无投票选项</p>
      </div>
    </section>

    <section v-if="canManage" class="section panel">
      <div class="section-title">
        <h2>团长操作</h2>
        <span class="muted">当前 {{ groupBuyStatusText[detail.status] }}</span>
      </div>
      <div class="status-actions">
        <van-button
          v-for="status in statusOptions"
          :key="status"
          size="small"
          :type="detail.status === status ? 'primary' : 'default'"
          @click="changeStatus(status)"
        >
          {{ groupBuyStatusText[status] }}
        </van-button>
      </div>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>接龙名单</h2>
        <span class="muted">{{ detail.joinRecords?.length || 0 }} 条</span>
      </div>
      <div class="stack">
        <div v-for="record in detail.joinRecords" :key="record.id" class="join-row">
          <div>
            <strong>{{ record.user?.nickname }}</strong>
            <span>{{ maskPhone(record.user?.phone || '') }}</span>
          </div>
          <div>
            <strong>{{ record.flavor }} × {{ record.quantity }}</strong>
            <span>{{ record.pickupPoint?.address }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="myReviewableRecord" class="section panel review-entry">
      <div>
        <strong>您已提货，去写个评价吧</strong>
        <p>分享你的体验，给其他小伙伴参考</p>
      </div>
      <van-button type="primary" size="small" @click="openReview">去评价</van-button>
    </section>

    <section class="section panel">
      <div class="section-title">
        <h2>大家的评价</h2>
        <span class="muted">{{ reviews.length }} 条</span>
      </div>
      <div v-if="reviews.length" class="review-list">
        <div v-for="review in reviews" :key="review.id" class="review-item">
          <div class="review-header">
            <div class="review-user">
              <img :src="review.user?.avatar || ''" :alt="review.user?.nickname" />
              <div>
                <strong>{{ review.user?.nickname || '匿名用户' }}</strong>
                <span class="review-meta">
                  <span class="stars">
                    <i v-for="i in 5" :key="i" :class="{ filled: i <= review.rating }">★</i>
                  </span>
                </span>
              </div>
            </div>
          </div>
          <p class="review-content">{{ review.content }}</p>
          <div class="review-footer">
            <span>{{ review.joinRecord?.flavor }} × {{ review.joinRecord?.quantity }}</span>
            <span class="review-time">{{ formatDateTime(review.created_at) }}</span>
          </div>
        </div>
      </div>
      <p v-else class="empty-copy">暂无评价</p>
    </section>

    <ReviewDialog
      v-model:visible="reviewVisible"
      :join-record="reviewableJoin"
      @success="handleReviewSuccess"
    />
  </main>
  <main v-else class="page">
    <van-skeleton title :row="6" />
  </main>
</template>

<style scoped>
.detail-hero {
  display: grid;
  gap: 18px;
  min-height: 190px;
  align-content: end;
  padding: 18px;
  border-radius: 8px;
  color: #fff8f2;
  background:
    linear-gradient(120deg, rgba(46, 29, 22, 0.82), rgba(46, 29, 22, 0.22)),
    url("https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80") center/cover;
}

.detail-hero h1 {
  margin: 10px 0 6px;
  font-size: 30px;
  line-height: 1.1;
  letter-spacing: 0;
}

.detail-hero p {
  margin: 0;
}

.price-block {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.price-block strong {
  font-size: 30px;
}

.price-block span {
  text-decoration: line-through;
  opacity: 0.78;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.detail-summary div {
  display: grid;
  gap: 6px;
}

.detail-summary span {
  color: #826d60;
  font-size: 12px;
}

.detail-summary strong {
  font-size: 15px;
}

.description,
.pickup-note {
  margin: 0;
  color: #4d382d;
  line-height: 1.7;
}

.pickup-note {
  margin-top: 10px;
  padding: 10px;
  border-radius: 8px;
  background: #edf4e8;
}

.join-form {
  display: grid;
  gap: 12px;
}

.vote-row {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 58px;
  overflow: hidden;
  padding: 12px;
  border: 1px solid #ead8c7;
  border-radius: 8px;
  color: #3b2a22;
  text-align: left;
  background: #fffaf4;
}

.vote-row strong,
.vote-row span {
  position: relative;
  z-index: 1;
}

.vote-row i {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(227, 93, 106, 0.14);
}

.vote-row.voted {
  border-color: #e35d6a;
}

.status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.join-row {
  display: grid;
  grid-template-columns: 0.82fr 1.18fr;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #ead8c7;
}

.join-row:last-child {
  border-bottom: 0;
}

.join-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.join-row span {
  overflow: hidden;
  color: #826d60;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-rating {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
}

.hero-rating .stars i {
  font-style: normal;
  color: rgba(255, 248, 242, 0.4);
  font-size: 14px;
}

.hero-rating .stars i.filled {
  color: #ffd27d;
}

.hero-rating .score {
  color: #fff8f2;
  font-weight: 700;
}

.hero-rating .count {
  color: rgba(255, 248, 242, 0.78);
}

.review-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff1f2;
  border-color: #f5c6cb;
}

.review-entry strong {
  color: #d94f5d;
  font-size: 14px;
}

.review-entry p {
  margin: 4px 0 0;
  color: #826d60;
  font-size: 12px;
}

.review-list {
  display: grid;
  gap: 14px;
}

.review-item {
  padding: 12px 0;
  border-bottom: 1px solid #ead8c7;
}

.review-item:last-child {
  border-bottom: 0;
}

.review-header {
  margin-bottom: 8px;
}

.review-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-user img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.review-user div {
  display: grid;
  gap: 3px;
}

.review-user strong {
  color: #33221b;
  font-size: 14px;
}

.review-meta {
  display: flex;
  align-items: center;
}

.review-meta .stars i {
  font-style: normal;
  color: #eedccb;
  font-size: 12px;
}

.review-meta .stars i.filled {
  color: #ffb23d;
}

.review-content {
  margin: 0 0 8px;
  color: #4d382d;
  font-size: 14px;
  line-height: 1.6;
}

.review-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9a8a7d;
}

.review-time {
  font-size: 12px;
  color: #b0a39a;
}

.empty-copy {
  margin: 0;
  padding: 20px 0;
  text-align: center;
  color: #b0a39a;
  font-size: 13px;
}
</style>
