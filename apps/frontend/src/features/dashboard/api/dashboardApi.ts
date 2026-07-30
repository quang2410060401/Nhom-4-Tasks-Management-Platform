import { apiClient, unwrapResponse } from '@/services/http';
import type { ApiResponse } from '@/services/http';
import type { DashboardData, MyDashboardData } from '@/types';

export function getGroupDashboardApi(groupId: string): Promise<DashboardData> {
  return unwrapResponse(apiClient.get<ApiResponse<DashboardData>>(`/groups/${groupId}/dashboard`));
}

export function getMyDashboardApi(): Promise<MyDashboardData> {
  return unwrapResponse(apiClient.get<ApiResponse<MyDashboardData>>('/dashboard/me'));
}
