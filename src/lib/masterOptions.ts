import { useQuery } from '@tanstack/react-query'
import { api } from '~/lib/api'
import type { CustomerDto, DriverDto, PageDto, TruckDto } from '~/shared/schemas'

/**
 * Dropdown options for the master records. One shared set of query keys so
 * every page reuses the same cache entries. The server caps pageSize at 100.
 */
const optionsPage = 'page=1&pageSize=100'

export function useCustomerOptions() {
  return useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () => api<PageDto<CustomerDto>>('GET', `/customers?${optionsPage}&sort=name&order=asc`),
  })
}

export function useTruckOptions() {
  return useQuery({
    queryKey: ['trucks', 'options'],
    queryFn: () => api<PageDto<TruckDto>>('GET', `/trucks?${optionsPage}&sort=registrationNumber&order=asc`),
  })
}

export function useDriverOptions() {
  return useQuery({
    queryKey: ['drivers', 'options'],
    queryFn: () => api<PageDto<DriverDto>>('GET', `/drivers?${optionsPage}&sort=name&order=asc`),
  })
}

/** All three master-option lists as plain arrays (empty while loading). */
export function useMasterOptions() {
  const customers = useCustomerOptions()
  const trucks = useTruckOptions()
  const drivers = useDriverOptions()
  return {
    customers: customers.data?.items ?? [],
    trucks: trucks.data?.items ?? [],
    drivers: drivers.data?.items ?? [],
  }
}
