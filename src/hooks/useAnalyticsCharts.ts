
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAnalyticsCharts = () => {
  // Batch performance over time
  const { data: batchTrends } = useQuery({
    queryKey: ['batch-trends'],
    queryFn: async () => {
      const { data } = await supabase
        .from('batches')
        .select('created_at, success_count, failure_count, status')
        .order('created_at', { ascending: true });

      return data?.map(batch => ({
        date: new Date(batch.created_at).toLocaleDateString(),
        success: batch.success_count,
        failures: batch.failure_count,
        total: batch.success_count + batch.failure_count
      })) || [];
    }
  });

  // Carrier performance comparison
  const { data: carrierStats } = useQuery({
    queryKey: ['carrier-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('esim_results')
        .select('att_status, tmo_status, verizon_status, global_status');

      const carriers = ['att', 'tmo', 'verizon', 'global'] as const;
      
      return carriers.map(carrier => {
        const statusField = `${carrier}_status` as keyof typeof data[0];
        const total = data?.filter(r => r[statusField]).length || 0;
        const successful = data?.filter(r => r[statusField] === 'SUCCESS').length || 0;
        
        return {
          carrier: carrier.toUpperCase(),
          total,
          successful,
          successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : '0'
        };
      });
    }
  });

  // Processing time distribution
  const { data: processingTimes } = useQuery({
    queryKey: ['processing-times'],
    queryFn: async () => {
      const { data } = await supabase
        .from('esim_results')
        .select('processing_duration_seconds')
        .not('processing_duration_seconds', 'is', null);

      if (!data?.length) return [];

      // Group processing times into buckets
      const buckets = [
        { range: '0-1s', min: 0, max: 1, count: 0 },
        { range: '1-3s', min: 1, max: 3, count: 0 },
        { range: '3-5s', min: 3, max: 5, count: 0 },
        { range: '5-10s', min: 5, max: 10, count: 0 },
        { range: '10s+', min: 10, max: Infinity, count: 0 }
      ];

      data.forEach(result => {
        const time = result.processing_duration_seconds;
        const bucket = buckets.find(b => time >= b.min && time < b.max);
        if (bucket) bucket.count++;
      });

      return buckets;
    }
  });

  return {
    batchTrends,
    carrierStats,
    processingTimes
  };
};
