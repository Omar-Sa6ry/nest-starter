export interface IPaginatedResult<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  totalPages?: number;
  limit?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  previousPage?: number;
  nextPage?: number;
}
