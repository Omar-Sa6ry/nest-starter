export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  nextPage?: number;
}