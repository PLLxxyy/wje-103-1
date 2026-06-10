import type { User } from './user';

export type Review = {
  id: string;
  group_buy_id: string;
  user_id: string;
  join_record_id: string;
  rating: number;
  content: string;
  created_at: string;
  user?: Pick<User, 'id' | 'nickname' | 'avatar'>;
  joinRecord?: {
    id: string;
    flavor: string;
    quantity: number;
  };
};

export type ReviewPayload = {
  join_record_id: string;
  rating: number;
  content: string;
};

export type RatingSummary = {
  average_rating: number;
  review_count: number;
};
