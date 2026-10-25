export interface IPaginatedResult<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  nextPage?: number;
}
