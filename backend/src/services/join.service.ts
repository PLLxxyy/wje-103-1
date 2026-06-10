import { GroupBuyStatus, UserRole } from '../types/enums';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/response';
import { reviewService } from './review.service';

const joinInclude = {
  groupBuy: {
    include: {
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
    }
  },
  user: {
    select: {
      id: true,
      nickname: true,
      phone: true,
      avatar: true,
      role: true,
      created_at: true
    }
  },
  pickupPoint: true,
  review: true
};

export type JoinInput = {
  group_buy_id: string;
  flavor: string;
  quantity: number;
  pickup_point_id: string;
};

const buildSummary = (records: Array<{
  flavor: string;
  quantity: number;
  picked_up: boolean;
  pickupPoint: { id: string; address: string; available_time: string };
}>) => {
  const byFlavor = new Map<string, { flavor: string; quantity: number; orders: number }>();
  const byPickupPoint = new Map<string, {
    pickup_point_id: string;
    address: string;
    available_time: string;
    quantity: number;
    orders: number;
  }>();

  records.forEach((record) => {
    const flavor = byFlavor.get(record.flavor) ?? { flavor: record.flavor, quantity: 0, orders: 0 };
    flavor.quantity += record.quantity;
    flavor.orders += 1;
    byFlavor.set(record.flavor, flavor);

    const pickup = byPickupPoint.get(record.pickupPoint.id) ?? {
      pickup_point_id: record.pickupPoint.id,
      address: record.pickupPoint.address,
      available_time: record.pickupPoint.available_time,
      quantity: 0,
      orders: 0
    };
    pickup.quantity += record.quantity;
    pickup.orders += 1;
    byPickupPoint.set(record.pickupPoint.id, pickup);
  });

  return {
    totalQuantity: records.reduce((sum, record) => sum + record.quantity, 0),
    totalOrders: records.length,
    pickedUpOrders: records.filter((record) => record.picked_up).length,
    byFlavor: Array.from(byFlavor.values()),
    byPickupPoint: Array.from(byPickupPoint.values())
  };
};

const attachRatingsToJoins = async <T extends { groupBuy?: { id: string } }>(records: T[]): Promise<T[]> => {
  const groupBuyIds = Array.from(new Set(records.map((r) => r.groupBuy?.id).filter(Boolean) as string[]));
  const ratingMap = await reviewService.batchGetGroupBuyRatings(groupBuyIds);
  return records.map((record) =>
    record.groupBuy
      ? {
          ...record,
          groupBuy: {
            ...record.groupBuy,
            average_rating: ratingMap[record.groupBuy.id]?.average_rating ?? 0,
            review_count: ratingMap[record.groupBuy.id]?.review_count ?? 0
          }
        }
      : record
  );
};

export const joinService = {
  async create(input: JoinInput, userId: string) {
    if (!input.group_buy_id || !input.pickup_point_id || !input.flavor?.trim()) {
      throw new AppError('团购、口味和提货点不能为空');
    }
    if (Number(input.quantity) <= 0) {
      throw new AppError('接龙数量必须大于 0');
    }

    const groupBuy = await prisma.groupBuy.findUnique({
      where: { id: input.group_buy_id },
      include: {
        pickupPoints: true,
        joinRecords: true
      }
    });
    if (!groupBuy) {
      throw new AppError('团购不存在', 404);
    }
    if (groupBuy.status !== GroupBuyStatus.RECRUITING) {
      throw new AppError('当前团购已停止接龙');
    }

    const pickupPoint = groupBuy.pickupPoints.find((point) => point.id === input.pickup_point_id);
    if (!pickupPoint) {
      throw new AppError('提货点不属于当前团购');
    }

    const reserved = groupBuy.joinRecords
      .filter((record) => record.pickup_point_id === input.pickup_point_id)
      .reduce((sum, record) => sum + record.quantity, 0);
    if (reserved + Number(input.quantity) > pickupPoint.max_capacity) {
      throw new AppError('该提货点容量不足，请选择其他提货点');
    }

    const record = await prisma.joinRecord.create({
      data: {
        group_buy_id: input.group_buy_id,
        user_id: userId,
        flavor: input.flavor.trim(),
        quantity: Number(input.quantity),
        pickup_point_id: input.pickup_point_id
      },
      include: joinInclude
    });
    const [withRating] = await attachRatingsToJoins([record]);
    return withRating;
  },

  async myJoins(userId: string) {
    const records = await prisma.joinRecord.findMany({
      where: { user_id: userId },
      include: joinInclude,
      orderBy: { joined_at: 'desc' }
    });
    return attachRatingsToJoins(records);
  },

  async manage(actor: { id: string; role: UserRole }, groupBuyId?: string) {
    const where =
      actor.role === UserRole.ADMIN
        ? { group_buy_id: groupBuyId }
        : { group_buy_id: groupBuyId, groupBuy: { leader_id: actor.id } };

    const records = await prisma.joinRecord.findMany({
      where,
      include: joinInclude,
      orderBy: { joined_at: 'desc' }
    });
    const ratedRecords = await attachRatingsToJoins(records);

    return {
      records: ratedRecords,
      summary: buildSummary(records)
    };
  },

  async markPicked(recordId: string, pickedUp: boolean, actor: { id: string; role: UserRole }) {
    const record = await prisma.joinRecord.findUnique({
      where: { id: recordId },
      include: {
        groupBuy: true
      }
    });
    if (!record) {
      throw new AppError('接龙记录不存在', 404);
    }
    if (actor.role !== UserRole.ADMIN && record.groupBuy.leader_id !== actor.id) {
      throw new AppError('只能管理自己团购的接龙记录', 403);
    }

    const updated = await prisma.joinRecord.update({
      where: { id: recordId },
      data: { picked_up: pickedUp },
      include: joinInclude
    });
    const [withRating] = await attachRatingsToJoins([updated]);
    return withRating;
  }
};
