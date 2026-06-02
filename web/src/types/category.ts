/** 对齐后端 app/schemas/category.py */

export interface CategoryCreate {
  name: string;
  icon?: string | null;
  color?: string | null;
  keywords?: string | null;
}

export interface CategoryUpdate {
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  keywords?: string | null;
}

export interface CategoryResponse {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  keywords: string | null;
  created_at: string;
}

export interface MatchRequest {
  text: string;
}

export interface MatchResponse {
  matched: boolean;
  category: CategoryResponse | null;
}
