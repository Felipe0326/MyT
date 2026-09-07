export type DashboardComponentProps = {
  isActive?: boolean;
  csrfToken: string;
  canUpdate?: boolean;
};

export type DailyChartPoint = {
  date: string;
  fullDate: Date;
  day: number;
  total: number;
  digital: number;
  traditional: number;
  unclassified?: number;
};
