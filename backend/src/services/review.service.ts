import { prisma } from '../utils/prisma';
import { AppError } from '../utils/response';

const reviewInclude = {
  user: {
    select: {
      id: true,
      nickname: true,
      avatar: true
    }
  },
  joinRecord: {
    select: {
      id: true,
      flavor: true,
      quantity: true
    }
  }
};

export type CreateReviewInput = {
  join_record_id: string;
  rating: number;
  content: string;
};

export const reviewService = {
  async create(input: CreateReviewInput, userId: string) {
    if (!input.join_record_id) {
      throw new AppError('接龙记录不能为空');
    }
    const rating = Number(input.rating);
    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('评分必须在 1-5 星之间');
    }
    if (!input.content?.trim()) {
      throw new AppError('评价内容不能为空');
    }

    const joinRecord = await prisma.joinRecord.findUnique({
      where: { id: input.join_record_id },
      include: { groupBuy: true }
    });
    if (!joinRecord) {
      throw new AppError('接龙记录不存在', 404);
    }
    if (joinRecord.user_id !== userId) {
      throw new AppError('只能评价自己的接龙', 403);
    }
    if (!joinRecord.picked_up) {
      throw new AppError('提货后才能评价', 400);
    }

    const existing = await prisma.review.findUnique({
      where: { join_record_id: input.join_record_id }
    });
    if (existing) {
      throw new AppError('已经评价过了', 400);
    }

    return prisma.review.create({
      data: {
        group_buy_id: joinRecord.group_buy_id,
        user_id: userId,
        join_record_id: input.join_record_id,
        rating,
        content: input.content.trim()
      },
      include: reviewInclude
    });
  },

  async listByGroupBuy(groupBuyId: string) {
    return prisma.review.findMany({
      where: { group_buy_id: groupBuyId },
      include: reviewInclude,
      orderBy: { created_at: 'desc' }
    });
  },

  async getGroupBuyRating(groupBuyId: string) {
    const result = await prisma.review.aggregate({
      where: { group_buy_id: groupBuyId },
      _avg: { rating: true },
      _count: { id: true }
    });
    return {
      average_rating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
      review_count: result._count.id
    };
  },

  async getShopRating(shopId: string) {
    const result = await prisma.review.aggregate({
      where: { groupBuy: { shop_id: shopId } },
      _avg: { rating: true },
      _count: { id: true }
    });
    return {
      average_rating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
      review_count: result._count.id
    };
  },

  async batchGetGroupBuyRatings(groupBuyIds: string[]) {
    if (!groupBuyIds.length) return {};
    const result = await prisma.review.groupBy({
      by: ['group_buy_id'],
      where: { group_buy_id: { in: groupBuyIds } },
      _avg: { rating: true },
      _count: { id: true }
    });
    const map: Record<string, { average_rating: number; review_count: number }> = {};
    result.forEach((item) => {
      map[item.group_buy_id] = {
        average_rating: item._avg.rating ? Number(item._avg.rating.toFixed(1)) : 0,
        review_count: item._count.id
      };
    });
    return map;
  }
};
