<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { showSuccessToast, showFailToast } from 'vant';
import { useReviewStore } from '@/stores/useReviewStore';
import type { JoinRecord } from '@/types/join';

const props = defineProps<{
  visible: boolean;
  joinRecord?: JoinRecord | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}>();

const reviewStore = useReviewStore();
const submitting = ref(false);
const form = reactive({
  rating: 5,
  content: ''
});

const popupShow = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val)
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      form.rating = 5;
      form.content = '';
    }
  }
);

const handleSubmit = async () => {
  if (!props.joinRecord) return;
  if (!form.content.trim()) {
    showFailToast('请填写评价内容');
    return;
  }
  submitting.value = true;
  try {
    await reviewStore.create({
      join_record_id: props.joinRecord.id,
      rating: form.rating,
      content: form.content.trim()
    });
    showSuccessToast('评价成功');
    emit('update:visible', false);
    emit('success');
  } catch (e: any) {
    showFailToast(e?.response?.data?.message || e?.message || '评价失败');
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <van-popup
    v-model:show="popupShow"
    position="bottom"
    round
    :style="{ height: '65%' }"
  >
    <div class="review-popup">
      <div class="popup-header">
        <h3>评价本次团购</h3>
      </div>
      <div class="popup-body">
        <div v-if="joinRecord?.groupBuy" class="review-gb">
          <strong>{{ joinRecord.groupBuy.title }}</strong>
          <span>{{ joinRecord.flavor }} × {{ joinRecord.quantity }}</span>
        </div>
        <div class="rate-row">
          <span>评分</span>
          <van-rate v-model="form.rating" :size="28" color="#ffd27d" void-color="#eedccb" />
        </div>
        <div class="textarea-row">
          <span>评价内容</span>
          <van-field
            v-model="form.content"
            type="textarea"
            rows="4"
            placeholder="分享你的体验..."
            maxlength="200"
            show-word-limit
            autosize
          />
        </div>
      </div>
      <div class="popup-footer">
        <van-button block type="primary" :loading="submitting" @click="handleSubmit">
          提交评价
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.review-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.popup-header {
  padding: 14px 16px;
  text-align: center;
  border-bottom: 1px solid #ead8c7;
}

.popup-header h3 {
  margin: 0;
  font-size: 16px;
  color: #33221b;
}

.popup-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  gap: 16px;
}

.review-gb {
  display: grid;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  background: #fff4ec;
}

.review-gb strong {
  color: #33221b;
  font-size: 15px;
}

.review-gb span {
  color: #826d60;
  font-size: 13px;
}

.rate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  background: #fffaf4;
  border: 1px solid #ead8c7;
}

.rate-row span {
  color: #62483b;
  font-size: 14px;
  font-weight: 600;
}

.textarea-row {
  display: grid;
  gap: 8px;
}

.textarea-row span {
  color: #62483b;
  font-size: 14px;
  font-weight: 600;
}

.popup-footer {
  padding: 12px 16px;
  border-top: 1px solid #ead8c7;
}
</style>
