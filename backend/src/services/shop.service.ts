import { prisma } from '../utils/prisma';
import { AppError } from '../utils/response';
import { reviewService } from './review.service';

const groupBuyForShop = {
  shop: true,
  leader: {
    select: {
      id: true,
      nickname: true,
      phone: true,
      avatar: true,
      role: true,
      created_at: true
    }
  },
  pickupPoints: true,
  joinRecords: true,
  voteOptions: {
    include: {
      voteRecords: true
    }
  }
};

const attachGroupBuyRatings = (groupBuys: Array<{ id: string }>) => {
  if (!groupBuys.length) return Promise.resolve(groupBuys);
  return reviewService.batchGetGroupBuyRatings(groupBuys.map((g) => g.id)).then((ratingMap) =>
    groupBuys.map((gb) => ({
      ...gb,
      average_rating: ratingMap[gb.id]?.average_rating ?? 0,
      review_count: ratingMap[gb.id]?.review_count ?? 0
    }))
  );
};

export const shopService = {
  async list() {
    const shops = await prisma.shop.findMany({
      include: {
        dessertItems: true,
        groupBuys: {
          include: groupBuyForShop,
          orderBy: { created_at: 'desc' }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    return Promise.all(
      shops.map(async (shop) => {
        const [rating, groupBuys] = await Promise.all([
          reviewService.getShopRating(shop.id),
          attachGroupBuyRatings(shop.groupBuys as Array<{ id: string }>)
        ]);
        return { ...shop, ...rating, groupBuys };
      })
    );
  },

  async detail(id: string) {
    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        dessertItems: true,
        groupBuys: {
          include: groupBuyForShop,
          orderBy: { created_at: 'desc' }
        }
      }
    });
    if (!shop) {
      throw new AppError('店铺不存在', 404);
    }
    const [rating, groupBuys] = await Promise.all([
      reviewService.getShopRating(id),
      attachGroupBuyRatings(shop.groupBuys as Array<{ id: string }>)
    ]);
    return { ...shop, ...rating, groupBuys };
  },

  async dessertItems(shopId: string) {
    await this.detail(shopId);
    return prisma.dessertItem.findMany({
      where: { shop_id: shopId },
      orderBy: [{ category: 'asc' }, { price: 'asc' }]
    });
  }
};
